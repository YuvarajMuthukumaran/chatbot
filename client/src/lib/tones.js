// Colours for a check-in result level. Full class names (not built with
// string templates) so Tailwind can see them.
export const TONES = {
  calm: {
    badge: "bg-teal-100 text-teal-800",
    bar: "bg-teal-400",
    soft: "bg-teal-50 border-teal-100",
    ring: "ring-teal-200",
    text: "text-teal-800",
  },
  mild: {
    badge: "bg-blue-100 text-blue-800",
    bar: "bg-blue-400",
    soft: "bg-blue-50 border-blue-100",
    ring: "ring-blue-200",
    text: "text-blue-800",
  },
  moderate: {
    badge: "bg-amber-100 text-amber-800",
    bar: "bg-amber-400",
    soft: "bg-amber-50 border-amber-100",
    ring: "ring-amber-200",
    text: "text-amber-800",
  },
  high: {
    badge: "bg-rose-100 text-rose-800",
    bar: "bg-rose-400",
    soft: "bg-rose-50 border-rose-100",
    ring: "ring-rose-200",
    text: "text-rose-800",
  },
};

export const toneOf = (tone) => TONES[tone] || TONES.mild;
