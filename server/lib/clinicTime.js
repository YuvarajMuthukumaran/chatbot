// All "what day is it / has this slot already passed" logic runs in the
// clinic's own timezone, never the server's. Hosts like Render run in UTC,
// 5.5 hours behind IST — without this, "today" rolled over at 5:30am IST
// instead of midnight, and whether a 9am slot counted as past depended on
// where the server happened to be deployed.
export const CLINIC_TIMEZONE = process.env.CLINIC_TIMEZONE || "Asia/Kolkata";

const partsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: CLINIC_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function clinicParts(now) {
  return Object.fromEntries(partsFormatter.formatToParts(now).map((p) => [p.type, p.value]));
}

/** Today's date at the clinic, as "YYYY-MM-DD". */
export function clinicToday(now = new Date()) {
  const p = clinicParts(now);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Minutes since midnight right now, at the clinic. */
export function clinicMinutesNow(now = new Date()) {
  const p = clinicParts(now);
  return Number(p.hour) * 60 + Number(p.minute);
}

function toUtcDate(isoDate) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Calendar arithmetic on "YYYY-MM-DD" strings — timezone-free by design. */
export function addDays(isoDate, days) {
  const dt = toUtcDate(isoDate);
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** 0 = Sunday … 6 = Saturday. */
export function weekdayOf(isoDate) {
  return toUtcDate(isoDate).getUTCDay();
}

export function daysBetween(fromIsoDate, toIsoDate) {
  return Math.round((toUtcDate(toIsoDate) - toUtcDate(fromIsoDate)) / 86_400_000);
}

/** "14:30" -> 870 */
export function timeToMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-10-05" -> "Mon, 5 Oct" (the year is added only when it isn't the
 * current one). Anything that isn't a plain ISO date is returned unchanged. */
export function formatDate(isoDate, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate || "")) return isoDate;
  const [y, m, d] = isoDate.split("-").map(Number);
  const label = `${WEEKDAYS[weekdayOf(isoDate)]}, ${d} ${MONTHS[m - 1]}`;
  return String(y) === clinicToday(now).slice(0, 4) ? label : `${label} ${y}`;
}

/** "14:30" (or "14:30:00") -> "2:30 PM". Anything else is returned unchanged. */
export function formatTime(hhmm) {
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(hhmm || "");
  if (!match) return hhmm;
  const hour = Number(match[1]);
  return `${hour % 12 === 0 ? 12 : hour % 12}:${match[2]} ${hour >= 12 ? "PM" : "AM"}`;
}

/** HMS timestamps ("2026-09-23 10:30:00", or a bare date) -> "Wed, 23 Sep 2026, 10:30 AM".
 * Falls back to the raw value for anything unrecognized, so an unexpected
 * format from the HMS is shown as-is rather than hidden. */
export function formatDateTime(raw, now = new Date()) {
  const match = /^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2})(?::\d{2})?)?$/.exec(String(raw || "").trim());
  if (!match) return raw;
  const date = formatDate(match[1], now);
  return match[2] ? `${date}, ${formatTime(match[2])}` : date;
}
