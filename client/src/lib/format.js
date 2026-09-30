// Date/time helpers shared by the booking pages.

/** Today's date in the browser's own timezone, as "YYYY-MM-DD". (Using
 * toISOString() here gave the UTC date — which in India is still
 * "yesterday" until 5:30am, so the date pickers defaulted to, and allowed,
 * a day that had already passed.) */
export function localIsoDate(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDaysIso(isoDate, days) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return localIsoDate(new Date(y, m - 1, d + days));
}

/** What a phone field keeps as it's typed: digits only, up to 12 — room for
 * a "+91" or leading "0" typed key by key, which a hard 10-digit cap would
 * have cut off mid-number (keeping "9198765432"). */
export function cleanPhoneInput(value) {
  return String(value).replace(/\D/g, "").slice(0, 12);
}

/** The 10-digit mobile number in a phone field's digits ("919876543210",
 * "09876543210", or "9876543210"), or null if it isn't one yet. */
export function tenDigitPhone(digits) {
  let d = String(digits);
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  else if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return /^\d{10}$/.test(d) ? d : null;
}

/** "14:30" -> "2:30 PM" */
export function formatSlot(time) {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

/** "2026-10-05" -> "Mon, 5 Oct 2026" (year left off when it's this year). */
export function formatDay(isoDate, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate || "")) return isoDate;
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const label = date.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
  return y === now.getFullYear() ? label : `${label} ${y}`;
}
