// Phone numbers in Tulasi's replies become tap-to-call buttons instead of
// digits to copy. Each known number is rewritten as a markdown link with a
// tel: address, which ChatBubble renders as a "Call" button.

const NUMBERS = [
  // Tulasi Health Care: "8800000255", "+91 8800000255", "+91-88000 00255".
  { source: String.raw`(?:\+?91[\s-]?)?(?:8800[\s-]?000[\s-]?255|88000[\s-]?00255)`, label: "Call Tulasi Health Care", tel: "+918800000255" },
  // Tele-MANAS, the national mental-health helpline (also 1-800-891-4416).
  { source: String.raw`1[\s-]?800[\s-]?891[\s-]?4416|(?<![\d₹,.])14416(?![\d,])`, label: "Call Tele-MANAS", tel: "14416" },
  // Emergency and the women's helpline — but not prices or counts ("₹112", "181 days").
  { source: String.raw`(?<![\d₹,.])112(?![\d,]|\s*(?:days?|rs|rupees|%))`, label: "Call 112", tel: "112" },
  { source: String.raw`(?<![\d₹,.])181(?![\d,]|\s*(?:days?|rs|rupees|%))`, label: "Call 181", tel: "181" },
];

// Existing markdown links are matched first and left untouched, so nothing
// is rewritten twice.
const PATTERN = new RegExp(`(\\[[^\\]]*\\]\\([^)]*\\))|${NUMBERS.map((n) => `(${n.source})`).join("|")}`, "g");

/** Rewrites known phone numbers in a reply as markdown tel: links. */
export function linkPhoneNumbers(text) {
  if (!text) return text;
  return text.replace(PATTERN, (match, link, ...groups) => {
    if (link) return link;
    const i = groups.slice(0, NUMBERS.length).findIndex((g) => g !== undefined);
    return `[${NUMBERS[i].label}](tel:${NUMBERS[i].tel})`;
  });
}

/** True for tel: links (rendered as Call buttons). */
export const isCallLink = (href) => typeof href === "string" && href.startsWith("tel:");
