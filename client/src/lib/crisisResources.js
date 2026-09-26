// Client-side fallback so the crisis button works even before a session
// has started (e.g. on the Home page). Mirrors server/lib/crisisResources.js
// for the default region; the authoritative list still comes from the
// server once a session exists.
export const FALLBACK_CRISIS_RESOURCES = {
  label: "India",
  lines: [
    { name: "Tulasi Health Care", phone: "8800000255", type: "call" },
    { name: "Tele-MANAS (Govt. of India, 24/7)", phone: "14416", type: "call" },
    { name: "Tele-MANAS (toll-free)", phone: "1800-891-4416", type: "call" },
    { name: "KIRAN Mental Health Helpline", phone: "1800-599-0019", type: "call" },
    { name: "Emergency services", phone: "112", type: "call" },
  ],
};

const STORAGE_KEY = "yuvaraj.crisisResources";

export function storeCrisisResources(resources) {
  if (resources) localStorage.setItem(STORAGE_KEY, JSON.stringify(resources));
}

export function getCrisisResources() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") || FALLBACK_CRISIS_RESOURCES;
  } catch {
    return FALLBACK_CRISIS_RESOURCES;
  }
}
