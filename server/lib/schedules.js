// Per-doctor OPD timings, so online booking only offers times the doctor is actually in.
//
// The text below is what each doctor's profile and service pages publish on the website
// (where pages disagree, every published timing is kept, since doctors work at more than
// one centre). Edit a line here to change when a doctor can be booked; a doctor who is
// not listed falls back to the default template in slots.js.
//
// Formats understood: "Mon – Sat (1:00 pm – 5:00 pm)", "Mon to Fri & Sun (5pm – 8 pm)",
// "Tue, Wed & Fri (10:00 am – 2:00 pm)", "Wed & Sat (5:00 pm Onwards)".

const OPD_TEXT = {
  "Dr. (Col.) Pavan Kumar Pardal": ["Tue, Wed & Fri (10:00 am – 2:00 pm)"],
  "Dr. Alisha Nagar": ["Mon to Sat (04:00 pm – 06:00 pm)","Mon & Wed (5:30 pm – 7:00 pm)"],
  "Dr. Anu Yadav": ["Wed & Sat (04:30 pm – 06:30 pm)"],
  "Dr. Gorav Gupta": ["Tue & Sat (10:00 am – 1:00 pm)","Tue & Fri (2 PM – 5 PM)","Tue & Sat (9:30 am- 2:00 pm)","Wed (12:00 pm – 4 pm)","Sat (10:00 am – 2 pm)","Wed & Sat (10:00 am- 1 pm)"],
  "Dr. Ichpreet Singh": ["Tue (6 pm – 8 pm)","Wed & Sat (4:00 pm – 6:00 pm)"],
  "Dr. Kritika Soni": ["Mon – Sat (10:00 am – 5:00 pm)"],
  "Dr. Naseem Akhtar Qureshi": ["Tue – Sat (10 am – 4 pm)"],
  "Dr. Pooja Sharma": ["Mon – Sat (1:00 pm – 5:00 pm)"],
  "Dr. Poorva Gupta": ["Mon to Sat (10:00 am – 06:00 am)","Sat (9:00 am – 11:00 am)"],
  "Dr. Pranita Gaur": ["Wed & Sat (10am – 2pm)"],
  "Dr. Ram Chander Jiloha": ["Mon, Thu & Sat (10:00 am – 2:00 pm)"],
  "Dr. Ratnarakshit Ingole": ["Tue & Fri (5:30 pm – 7:30 pm)","Mon – Fri (5:00 pm – 7:30 pm)"],
  "Dr. Rini Maurya": ["Mon – Sat (3 PM – 7 PM)"],
  "Dr. Sameer Guliani": ["Mon to Sat (10 am to 6 pm)","Mon to Sat (10 am to 1 pm)"],
  "Dr. Samridhi Sandooja": ["Mon to Sat (5:30 pm – 7:30 pm)"],
  "Dr. Suravi Das": ["Mon to Sat (4:30 pm – 9:00 pm)"],
  "Mr. Inderjeet Singh": ["Mon – Sat (2 pm – 8 pm)"],
  "Mr. Suparas Jain": ["Mon to Fri & Sun (5pm – 8 pm)"],
  "Ms. Aastha Dwivedi": ["Mon & Wed (5:00 pm Onwards)"],
  "Ms. Angshruta Mahanta": ["Mon to Sat (5pm – 8 pm)"],
  "Ms. Ankita Bhatnagar": ["Mon – Sat (05:00 pm – 07:00 pm )"],
  "Ms. Apoorva Khanna": ["Mon to Sat (9am – 7pm)"],
  "Ms. Barkha Soni": ["Mon to Sat (5pm – 8 pm)"],
  "Ms. Chaya Chaudhary": ["Mon – Sat (06:00 pm – 08:00 pm )","Mon & Wed (9:00 am – 11:00 am )"],
  "Ms. Deliaka Ghanghass": ["Mon to Sat (5pm – 8 pm)"],
  "Ms. Ekta Kashyap": ["Mon – Sat (06:00 pm – 08:00 pm )"],
  "Ms. Hardika": ["Mon to Sat (9am – 6pm)"],
  "Ms. Husna Zahid Hussain": ["Mon to Sat (6pm – 8 pm)"],
  "Ms. Jyoti": ["Mon – Sat (05:00 pm – 07:00 pm )"],
  "Ms. Kiran Singh": ["Wed & Sat (5:00 pm Onwards)"],
  "Ms. Manju Kumari": ["Wed & Sat (5:00 pm Onwards)"],
  "Ms. Surabhi Sengar": ["Mon to Sat (6pm – 8 pm)"],
  "Ms. Titiksha Agnihotri": ["Mon to Sat (9am – 6pm)"],
};

const SLOT_MINUTES = 30;
const DAY_INDEX = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
const ONWARDS_HOURS = 3; // "5 pm onwards" has no stated end
const LAST_END_MINUTE = 21 * 60; // nothing is ever offered after 9 pm

/** "Dr. (Col.) Pavan Kumar Pardal" -> "pavan kumar pardal", so site and database names meet. */
export const normName = (n) =>
  String(n ?? "").toLowerCase().replace(/\(.*?\)/g, "").replace(/\b(dr|ms|mr|mrs)\b\.?/g, "").replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();

function parseDays(text) {
  const days = new Set();
  for (const part of text.split(/,|&|\band\b/i)) {
    const range = part.match(/([a-z]{3})[a-z]*\s*(?:–|-|—|to)\s*([a-z]{3})[a-z]*/i);
    if (range) {
      const from = DAY_INDEX[range[1].toLowerCase()];
      const to = DAY_INDEX[range[2].toLowerCase()];
      if (from === undefined || to === undefined) continue;
      for (let d = from; ; d = (d + 1) % 7) {
        days.add(d);
        if (d === to) break;
      }
      continue;
    }
    const one = part.match(/([a-z]{3})[a-z]*/i);
    if (one && DAY_INDEX[one[1].toLowerCase()] !== undefined) days.add(DAY_INDEX[one[1].toLowerCase()]);
  }
  return [...days];
}

function parseMinutes(h, m, ap) {
  let hour = Number(h) % 12;
  if (ap.toLowerCase() === "pm") hour += 12;
  return hour * 60 + Number(m ?? 0);
}

/** One published timing -> { days: number[], start, end } in minutes from midnight, or null. */
export function parseOpd(text) {
  const open = text.indexOf("(");
  if (open < 0) return null;
  const days = parseDays(text.slice(0, open));
  const times = [...text.slice(open).matchAll(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/gi)].map((m) => parseMinutes(m[1], m[2], m[3]));
  if (!days.length || !times.length) return null;
  const start = times[0];
  let end = times[1] ?? start + ONWARDS_HOURS * 60;
  if (end <= start && end + 12 * 60 > start) end += 12 * 60; // "10:00 am – 06:00 am" is a typo for 6 pm
  end = Math.min(end, LAST_END_MINUTE);
  return end > start ? { days, start, end } : null;
}

const SCHEDULES = new Map(
  Object.entries(OPD_TEXT).map(([name, texts]) => [normName(name), texts.map(parseOpd).filter(Boolean)])
);

/** Day of the week (0 = Sunday) of a YYYY-MM-DD date, independent of the server's timezone. */
export const weekdayOf = (date) => new Date(`${date}T12:00:00Z`).getUTCDay();

const hhmm = (min) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/**
 * Bookable start times ("HH:MM", every 30 minutes) for a doctor on a date, from their published
 * OPD timings. Returns null when we have no timings for them (callers use the default template),
 * and [] when they simply do not sit that day.
 */
export function scheduleSlots(doctorName, date) {
  if (process.env.OPD_SCHEDULES === "off") return null; // tests only
  const rules = SCHEDULES.get(normName(doctorName));
  if (!rules?.length) return null;
  const day = weekdayOf(date);
  const times = new Set();
  for (const r of rules) {
    if (!r.days.includes(day)) continue;
    for (let t = r.start; t + SLOT_MINUTES <= r.end; t += SLOT_MINUTES) times.add(t);
  }
  return [...times].sort((a, b) => a - b).map(hhmm);
}

export const hasSchedule = (doctorName) => !!SCHEDULES.get(normName(doctorName))?.length;
