// Fixed daily slot template — every 30 minutes, 9am–1pm and 2pm–5pm
// (a lunch gap), the same for every doctor since none of the scraped
// doctor data includes real per-doctor working hours.
const MORNING = { startHour: 9, endHour: 13 };
const AFTERNOON = { startHour: 14, endHour: 17 };
const SLOT_MINUTES = 30;

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

/** @param {string[]} bookedTimes - times already booked for this doctor+date */
export function availableSlots(bookedTimes) {
  const booked = new Set(bookedTimes);
  return allDailySlots().filter((t) => !booked.has(t));
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidDate(date) {
  if (!DATE_PATTERN.test(date)) return false;
  const d = new Date(`${date}T00:00:00`);
  return !Number.isNaN(d.getTime());
}

export function isValidSlotTime(time) {
  return TIME_PATTERN.test(time) && allDailySlots().includes(time);
}
