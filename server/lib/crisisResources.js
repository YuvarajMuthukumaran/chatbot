// Crisis hotline directories by region. Extend this map to add more
// deployment countries. Keep numbers current — verify periodically.
export const CRISIS_RESOURCES = {
  IN: {
    label: "India",
    lines: [
      { name: "Tele-MANAS (Govt. of India, 24/7)", phone: "14416", type: "call" },
      { name: "Tele-MANAS (toll-free)", phone: "1800-891-4416", type: "call" },
      { name: "KIRAN Mental Health Helpline", phone: "1800-599-0019", type: "call" },
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
