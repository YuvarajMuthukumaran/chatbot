import { clinicToday, clinicMinutesNow, addDays, timeToMinutes } from "./clinicTime.js";
import { scheduleSlots } from "./schedules.js";

// Default daily slot template — every 30 minutes, 9am–1pm and 2pm–5pm (a lunch gap).
// Doctors with published OPD timings (see schedules.js) use those instead; this template
// is only the fallback for a doctor we have no timings for.
const MORNING = { startHour: 9, endHour: 13 };
const AFTERNOON = { startHour: 14, endHour: 17 };
const SLOT_MINUTES = 30;

// A same-day slot starting sooner than this isn't offered — nobody can
// realistically make a 10:00 appointment booked at 9:55.
const SAME_DAY_LEAD_MINUTES = 30;

// How far ahead appointments can be booked.
export const BOOKING_WINDOW_DAYS = Number(process.env.BOOKING_WINDOW_DAYS) || 90;

function slotsForRange({ startHour, endHour }) {
  const slots = [];
  for (let h = startHour; h < endHour; h++) {
    for (let m = 0; m < 60; m += SLOT_MINUTES) {
      slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return slots;
}

export function allDailySlots() {
  return [...slotsForRange(MORNING), ...slotsForRange(AFTERNOON)];
}

/**
 * @param {string[]} bookedTimes - times already booked for this doctor+date
 * @param {{date?: string, now?: Date, doctorName?: string}} [options] - when `date` is today (at
 *   the clinic), slots that have already passed are left out too. With `doctorName` and `date`,
 *   only times inside that doctor's published OPD hours on that weekday are offered.
 */
export function availableSlots(bookedTimes, { date, now = new Date(), doctorName } = {}) {
  const booked = new Set(bookedTimes);
  const own = doctorName && date ? scheduleSlots(doctorName, date) : null;
  let slots = (own ?? allDailySlots()).filter((t) => !booked.has(t));
  if (date && date === clinicToday(now)) {
    const cutoff = clinicMinutesNow(now) + SAME_DAY_LEAD_MINUTES;
    slots = slots.filter((t) => timeToMinutes(t) >= cutoff);
  }
  return slots;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidDate(date) {
  if (typeof date !== "string" || !DATE_PATTERN.test(date)) return false;
  const [y, m, d] = date.split("-").map(Number);
  // Component constructor rolls invalid values over (Feb 30 -> Mar 2)
  // instead of rejecting them — round-tripping the parts catches that.
  const parsed = new Date(y, m - 1, d);
  return parsed.getFullYear() === y && parsed.getMonth() === m - 1 && parsed.getDate() === d;
}

export function isValidSlotTime(time) {
  if (typeof time !== "string" || !TIME_PATTERN.test(time)) return false;
  if (allDailySlots().includes(time)) return true;
  // Evening OPDs: any half-hour start up to 8:30 pm that some doctor publishes.
  const [h, m] = time.split(":").map(Number);
  return h >= 6 && h < 21 && m % SLOT_MINUTES === 0;
}

/**
 * Whether `date` can be booked at all: a real calendar date, not in the past
 * (at the clinic), and within the booking window.
 * @returns {"ok" | "invalid" | "past" | "too_far"}
 */
export function checkBookableDate(date, now = new Date()) {
  if (!isValidDate(date)) return "invalid";
  const today = clinicToday(now);
  if (date < today) return "past";
  if (date > addDays(today, BOOKING_WINDOW_DAYS)) return "too_far";
  return "ok";
}
