import { readJson, writeJson } from "./storage.js";

// Client-side fallback so the crisis button works even before a session
// has started (e.g. on the Home page). Mirrors server/lib/crisisResources.js
// for the default region; the authoritative list still comes from the
// server once a session exists.
export const FALLBACK_CRISIS_RESOURCES = {
  label: "India",
  lines: [
    { name: "Tulasi Health Care", phone: "8800000255", type: "call" },
    { name: "Tele-MANAS (free, 24/7)", phone: "14416", type: "call" },
    { name: "Emergency services", phone: "112", type: "call" },
  ],
};

const STORAGE_KEY = "yuvaraj.crisisResources";

export function storeCrisisResources(resources) {
  if (resources) writeJson(STORAGE_KEY, resources);
}

export function getCrisisResources() {
  return readJson(STORAGE_KEY) || FALLBACK_CRISIS_RESOURCES;
}
