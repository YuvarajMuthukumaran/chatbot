import { API_BASE } from "./apiBase.js";
import { readJson, writeJson, remove } from "./storage.js";

async function handleJson(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || "Something went wrong");
    err.status = res.status;
    throw err;
  }
  return data;
}

export async function fetchMedicines() {
  return handleJson(await fetch(`${API_BASE}/api/medicines`));
}

export async function fetchMedicine(slug) {
  return handleJson(await fetch(`${API_BASE}/api/medicines/${encodeURIComponent(slug)}`));
}

// The last result of each check-in, kept on this device only, so the
// check-ins page can show "Last time: Mild, 12 Sep" and people can see change
// over time. Only the level and score are kept, never the answers.
const CHECK_IN_KEY = "tulasi.checkIns";

export function getLastResults() {
  return readJson(CHECK_IN_KEY) || {};
}

export function saveResult(id, { score, max, label, tone }) {
  writeJson(CHECK_IN_KEY, { ...getLastResults(), [id]: { score, max, label, tone, at: Date.now() } });
}

export function forgetResults() {
  remove(CHECK_IN_KEY);
}
