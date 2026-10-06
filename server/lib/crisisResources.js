// Crisis hotline directories by region. Extend this map to add more
// deployment countries. Keep numbers current — verify periodically.
export const CRISIS_RESOURCES = {
  // Tulasi first, but never alone: a clinic line can go unanswered at 3 a.m.
  // and someone in danger needs a number that always picks up. Tele-MANAS is
  // the government's free 24/7 mental-health helpline (also 1-800-891-4416).
  IN: {
    label: "India",
    lines: [
      { name: "Tulasi Health Care", phone: "8800000255", type: "call" },
      { name: "Tele-MANAS (free, 24/7)", phone: "14416", type: "call" },
      { name: "Emergency services", phone: "112", type: "call" },
    ],
  },
  US: {
    label: "United States",
    lines: [
      { name: "988 Suicide & Crisis Lifeline", phone: "988", type: "call" },
      { name: "Crisis Text Line", phone: "Text HOME to 741741", type: "text" },
      { name: "Emergency services", phone: "911", type: "call" },
    ],
  },
  UK: {
    label: "United Kingdom",
    lines: [
      { name: "Samaritans (24/7)", phone: "116 123", type: "call" },
      { name: "SHOUT Crisis Text Line", phone: "Text SHOUT to 85258", type: "text" },
      { name: "Emergency services", phone: "999", type: "call" },
    ],
  },
  AU: {
    label: "Australia",
    lines: [
      { name: "Lifeline Australia (24/7)", phone: "13 11 14", type: "call" },
      { name: "Beyond Blue", phone: "1300 22 4636", type: "call" },
      { name: "Emergency services", phone: "000", type: "call" },
    ],
  },
};

export const DEFAULT_REGION = "IN";

export function getCrisisResources(region) {
  return CRISIS_RESOURCES[region] || CRISIS_RESOURCES[DEFAULT_REGION];
}
