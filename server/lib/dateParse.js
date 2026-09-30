// Free-text date and time parsing for the chat booking flow. Pure functions
// (the current time is passed in) so every phrasing can be unit-tested.
import { clinicToday, addDays, weekdayOf } from "./clinicTime.js";

const MONTHS = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};
const WEEKDAYS = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tues: 2, tuesday: 2,
  wed: 3, weds: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
};
// Longest first so "september" wins over "sep", "thursday" over "thu".
const alternation = (words) => Object.keys(words).sort((a, b) => b.length - a.length).join("|");
const MONTH_PATTERN = alternation(MONTHS);
const WEEKDAY_PATTERN = alternation(WEEKDAYS);

// Relative day words, including the regional ones people type in romanized or
// native script. "kal"/"parso" mean both yesterday/tomorrow in Hindi, but a
// booking is always for the future, so only the forward meaning applies here.
const DAY_AFTER_TOMORROW = /\bday after (?:tomorrow|tmrw|tmr)\b|\bparso\b|परसों/i;
const TOMORROW = /\b(?:tomorrow|tomorow|tommorow|tommorrow|tmrw|tmr|kal|naalai|nalai|repu)\b|कल|நாளை|రేపు/i;
const TODAY = /\b(?:today|aaj|indru|inniki|ivala|ivvala|eeroju)\b|आज|இன்று|ఈరోజు/i;

const pad2 = (n) => String(n).padStart(2, "0");

const DATE_WORD = new RegExp(
  `^(?:${MONTH_PATTERN}|${WEEKDAY_PATTERN}|today|tomorrow|tmrw|tmr|tonight|kal|parso|aaj|\\d{1,2}(?:st|nd|rd|th))$`,
  "i"
);

/** True for a single word that names a day or date ("october", "friday",
 * "tomorrow", "5th") — never a person's name. */
export function isDateWord(word) {
  return DATE_WORD.test(String(word).trim());
}

// Day + month with no year: the next time that date comes around (this year,
// or next year if it has already passed).
function nextOccurrence(month, day, today) {
  const year = Number(today.slice(0, 4));
  const candidate = `${year}-${pad2(month)}-${pad2(day)}`;
  return candidate >= today ? candidate : `${year + 1}-${pad2(month)}-${pad2(day)}`;
}

// "the 5th": this month if the 5th hasn't passed yet, otherwise next month.
function nextDayOfMonth(day, today) {
  let [year, month, current] = today.split("-").map(Number);
  if (day < current) {
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function expandYear(y) {
  return y.length === 2 ? `20${y}` : y;
}

/**
 * Finds a date anywhere in free text: "today", "tomorrow", "day after
 * tomorrow", "next friday", "5th oct", "october 5 2026", "05/10/2026",
 * "2026-10-05". Numeric dates are read day-first (D/M/Y), as written in India.
 * @param {string} text
 * @param {{now?: Date, strict?: boolean}} [options] - strict mode (used when
 *   scanning a whole booking request rather than an answer to "which date?")
 *   only accepts a weekday written out in full or introduced by on/this/next,
 *   so a stray "sat" or "mon" in a sentence isn't read as a date.
 * @returns {string|null} "YYYY-MM-DD", or null if no date was found. The
 *   result can still be an impossible date (Feb 30) — callers validate it.
 */
export function parseDate(text, { now = new Date(), strict = false } = {}) {
  if (typeof text !== "string" || !text.trim()) return null;
  const t = text.toLowerCase();
  const today = clinicToday(now);

  if (DAY_AFTER_TOMORROW.test(t)) return addDays(today, 2);
  if (TOMORROW.test(t)) return addDays(today, 1);
  if (TODAY.test(t)) return today;

  let m = t.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (m) return `${m[1]}-${pad2(m[2])}-${pad2(m[3])}`;

  // "5 oct", "5th of october", "5 october 2026"
  m = t.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${MONTH_PATTERN})\\b\\.?(?:,?\\s+(\\d{4}))?`));
  if (m) {
    const [, day, monthName, year] = m;
    return year ? `${year}-${pad2(MONTHS[monthName])}-${pad2(day)}` : nextOccurrence(MONTHS[monthName], Number(day), today);
  }

  // "oct 5", "october 5th", "oct 5, 2026"
  m = t.match(new RegExp(`\\b(${MONTH_PATTERN})\\b\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:,?\\s+(\\d{4}))?`));
  if (m) {
    const [, monthName, day, year] = m;
    return year ? `${year}-${pad2(MONTHS[monthName])}-${pad2(day)}` : nextOccurrence(MONTHS[monthName], Number(day), today);
  }

  // "05/10/2026", "5-10-26", "5.10.2026" — and "5/10" with no year. A dotted
  // date needs its year: "10.30" on its own is far more likely a time.
  m = t.match(/\b(\d{1,2})([/.-])(\d{1,2})(?:\2(\d{4}|\d{2}))?(?![\d/.-]*\d)/);
  if (m && (m[4] || m[2] !== ".")) {
    const [, day, , month, year] = m;
    return year ? `${expandYear(year)}-${pad2(month)}-${pad2(day)}` : nextOccurrence(Number(month), Number(day), today);
  }

  // "friday", "this friday", "next friday", "coming friday". "this <day>" can
  // mean today; a bare or "next" weekday always means a later day, since
  // anyone meaning today would just say "today".
  m = t.match(new RegExp(`\\b(on\\s+|this\\s+|next\\s+|coming\\s+)?(${WEEKDAY_PATTERN})\\b`));
  if (m && (!strict || m[1] || m[2].length > 4)) {
    const target = WEEKDAYS[m[2]];
    let delta = (target - weekdayOf(today) + 7) % 7;
    if (delta === 0 && !/^this/.test(m[1] || "")) delta = 7;
    return addDays(today, delta);
  }

  // "the 5th", "on 21st"
  m = t.match(/\b(\d{1,2})(?:st|nd|rd|th)\b/);
  if (m) return nextDayOfMonth(Number(m[1]), today);

  return null;
}

const MERIDIEM = String.raw`(a\.?\s?m\b\.?|p\.?\s?m\b\.?)`;
// "10:30", "10.30", "10:30am", "2.30 p.m."
const WITH_MINUTES = new RegExp(String.raw`\b([01]?\d|2[0-3])\s*[:.]\s*([0-5]\d)(?!\d)\s*${MERIDIEM}?`, "i");
const WITH_COLON = new RegExp(String.raw`\b([01]?\d|2[0-3])\s*:\s*([0-5]\d)(?!\d)\s*${MERIDIEM}?`, "i");
// "10am", "2 pm"
const HOUR_WITH_MERIDIEM = new RegExp(String.raw`\b([01]?\d|2[0-3])\s*${MERIDIEM}`, "i");
// "10 o'clock", "4 baje"
const HOUR_WITH_MARKER = /\b([01]?\d|2[0-3])\s*(?:o'?\s?clock|baje)\b/i;
// "at 11" (not "at 11th")
const AT_HOUR = /\bat\s+([01]?\d|2[0-3])\b(?![:.]?\d|st|nd|rd|th)/i;
// The whole message is just a time: "10", "at 3", "1030", "930"
const BARE = /^\s*(?:at\s+)?([01]?\d|2[0-3])([0-5]\d)?\s*$/i;

function to24h(hour, minute, meridiem) {
  let h = Number(hour);
  if (meridiem) {
    const pm = meridiem[0].toLowerCase() === "p";
    if (pm && h < 12) h += 12;
    if (!pm && h === 12) h = 0;
  } else if (h >= 1 && h <= 7) {
    // No am/pm: the clinic sees patients 9am–5pm, so a "2" or "4:30" can
    // only sensibly mean the afternoon.
    h += 12;
  }
  return `${pad2(h)}:${minute || "00"}`;
}

/**
 * Finds a time in free text: "10:30", "10.30", "2:30" (afternoon), "10am",
 * "2 pm", "noon", "4 baje", or just "3".
 * @param {string} text
 * @param {{strict?: boolean}} [options] - strict mode (used when scanning a
 *   whole booking request rather than an answer to "what time?") ignores
 *   ambiguous forms like "10.30" or a bare number.
 * @returns {string|null} "HH:MM" in 24-hour time, or null
 */
export function parseTime(text, { strict = false } = {}) {
  if (typeof text !== "string" || !text.trim()) return null;
  if (/\b(?:12\s*)?noon\b/i.test(text)) return "12:00";

  let m = text.match(strict ? WITH_COLON : WITH_MINUTES);
  if (m) return to24h(m[1], m[2], m[3]);

  m = text.match(HOUR_WITH_MERIDIEM);
  if (m) return to24h(m[1], null, m[2]);

  m = text.match(HOUR_WITH_MARKER) || text.match(AT_HOUR);
  if (m) return to24h(m[1], null, null);

  if (!strict) {
    m = text.match(BARE);
    if (m) return to24h(m[1], m[2], null);
  }
  return null;
}
