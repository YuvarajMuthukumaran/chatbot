import { motion, AnimatePresence } from "framer-motion";

const MOOD_LABELS = {
  neutral: "calm",
  happy: "happy",
  excited: "excited",
  anxious: "anxious",
  sad: "sad",
  angry: "frustrated",
  tired: "tired",
};

const LEAF_TINTS = {
  neutral: "#5FA774",
  happy: "#7CB955",
  excited: "#8CC63F",
  anxious: "#6FA98A",
  sad: "#6C97A0",
  angry: "#B26A5A",
  tired: "#7C9184",
};

const GLOWS = {
  neutral: "transparent",
  happy: "#FFE9A8",
  excited: "#FFD54D",
  anxious: "transparent",
  sad: "#BFDCE8",
  angry: "#F3B3A6",
  tired: "transparent",
};

// Idle/mood body motion — a gentle breathing sway by default, with a
// distinct feel per mood (a nervous tremble, an excited bounce, a slow
// droop) so the mascot reads as reacting, not just decorative.
const BODY_MOTION = {
  neutral: {
    animate: { scale: [1, 1.03, 1], rotate: [0, -1, 0, 1, 0] },
    transition: { duration: 4, repeat: Infinity, ease: "easeInOut" },
  },
  happy: {
    animate: { scale: [1, 1.05, 1], y: [0, -2, 0] },
    transition: { duration: 2.2, repeat: Infinity, ease: "easeInOut" },
  },
  excited: {
    animate: { scale: [1, 1.1, 1], y: [0, -5, 0], rotate: [0, -3, 3, 0] },
    transition: { duration: 0.9, repeat: Infinity, ease: "easeInOut" },
  },
  anxious: {
    animate: { x: [0, -1.5, 1.5, -1.5, 0], y: [0, 1, -1, 1, 0] },
    transition: { duration: 0.35, repeat: Infinity, ease: "easeInOut" },
  },
  sad: {
    animate: { scale: [1, 1.015, 1], y: [0, 2, 0], rotate: [0, 1, 0] },
    transition: { duration: 5, repeat: Infinity, ease: "easeInOut" },
  },
  angry: {
    animate: { x: [0, -1.5, 1.5, 0], rotate: [0, -1.5, 1.5, 0] },
    transition: { duration: 0.5, repeat: Infinity, ease: "easeInOut" },
  },
  tired: {
    animate: { scale: [1, 1.015, 1], y: [0, 3, 0] },
    transition: { duration: 5.5, repeat: Infinity, ease: "easeInOut" },
  },
};

function Sparkle({ x, y, delay }) {
  return (
    <motion.path
      d={`M${x},${y - 6} L${x + 2},${y - 2} L${x + 6},${y} L${x + 2},${y + 2} L${x},${y + 6} L${x - 2},${y + 2} L${x - 6},${y} L${x - 2},${y - 2} Z`}
      fill="#FFD54D"
      initial={{ opacity: 0.3, scale: 0.8 }}
      animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.1, 0.8] }}
      transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut", delay }}
    />
  );
}

function Face({ mood }) {
  switch (mood) {
    case "happy":
      return (
        <>
          <path d="M40,60 Q46,52 52,60" stroke="#2F3A2A" strokeWidth="4" strokeLinecap="round" fill="none" />
          <path d="M68,60 Q74,52 80,60" stroke="#2F3A2A" strokeWidth="4" strokeLinecap="round" fill="none" />
          <path d="M44,74 Q60,90 76,74" stroke="#2F3A2A" strokeWidth="4.5" strokeLinecap="round" fill="none" />
        </>
      );
    case "excited":
      return (
        <>
          <circle cx="46" cy="59" r="6.5" fill="#2F3A2A" />
          <circle cx="48.5" cy="56.5" r="2" fill="#fff" />
          <circle cx="74" cy="59" r="6.5" fill="#2F3A2A" />
          <circle cx="76.5" cy="56.5" r="2" fill="#fff" />
          <path d="M42,72 Q60,94 78,72 Q60,84 42,72 Z" fill="#2F3A2A" />
          <Sparkle x={22} y={28} delay={0} />
          <Sparkle x={98} y={40} delay={0.3} />
          <Sparkle x={90} y={90} delay={0.6} />
        </>
      );
    case "anxious":
      return (
        <>
          <circle cx="46" cy="59" r="7" fill="#fff" stroke="#2F3A2A" strokeWidth="2" />
          <circle cx="47" cy="60" r="2.6" fill="#2F3A2A" />
          <circle cx="74" cy="59" r="7" fill="#fff" stroke="#2F3A2A" strokeWidth="2" />
          <circle cx="75" cy="60" r="2.6" fill="#2F3A2A" />
          <path
            d="M48,80 Q52,76 56,80 Q60,84 64,80 Q68,76 72,80"
            stroke="#2F3A2A"
            strokeWidth="3.5"
            strokeLinecap="round"
            fill="none"
          />
          <path d="M90,32 Q94,38 90,44 Q86,38 90,32 Z" fill="#8FCBE8" opacity="0.85" />
        </>
      );
    case "sad":
      return (
        <>
          <path d="M40,62 Q46,56 52,62" stroke="#2F3A2A" strokeWidth="4" strokeLinecap="round" fill="none" />
          <path d="M68,62 Q74,56 80,62" stroke="#2F3A2A" strokeWidth="4" strokeLinecap="round" fill="none" />
          <path d="M44,82 Q60,70 76,82" stroke="#2F3A2A" strokeWidth="4" strokeLinecap="round" fill="none" />
          <path d="M48,66 Q46,74 49,79 Q52,75 48,66 Z" fill="#8FCBE8" opacity="0.9" />
        </>
      );
    case "angry":
      return (
        <>
          <line x1="38" y1="50" x2="50" y2="56" stroke="#2F3A2A" strokeWidth="3.5" strokeLinecap="round" />
          <line x1="82" y1="50" x2="70" y2="56" stroke="#2F3A2A" strokeWidth="3.5" strokeLinecap="round" />
          <circle cx="46" cy="61" r="3.5" fill="#2F3A2A" />
          <circle cx="74" cy="61" r="3.5" fill="#2F3A2A" />
          <path d="M46,80 Q60,74 74,80" stroke="#2F3A2A" strokeWidth="4" strokeLinecap="round" fill="none" />
        </>
      );
    case "tired":
      return (
        <>
          <line x1="40" y1="60" x2="52" y2="60" stroke="#2F3A2A" strokeWidth="3.5" strokeLinecap="round" />
          <line x1="68" y1="60" x2="80" y2="60" stroke="#2F3A2A" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M46,78 Q60,76 74,78" stroke="#2F3A2A" strokeWidth="3.5" strokeLinecap="round" fill="none" />
          <text x="88" y="34" fontSize="11" fill="#7C9184" opacity="0.8" fontFamily="sans-serif">
            z
          </text>
          <text x="97" y="24" fontSize="8" fill="#7C9184" opacity="0.6" fontFamily="sans-serif">
            z
          </text>
        </>
      );
    case "neutral":
    default:
      return (
        <>
          <circle cx="46" cy="60" r="4" fill="#2F3A2A" />
          <circle cx="74" cy="60" r="4" fill="#2F3A2A" />
          <path d="M48,77 Q60,83 72,77" stroke="#2F3A2A" strokeWidth="3.5" strokeLinecap="round" fill="none" />
        </>
      );
  }
}

/**
 * Animated tulasi-leaf mascot whose expression reacts to `mood`.
 * `streaming` overrides the idle motion with a faster "thinking" pulse.
 */
export default function TulasiMascot({ mood = "neutral", streaming = false, className = "" }) {
  const safeMood = MOOD_LABELS[mood] ? mood : "neutral";
  const body = streaming
    ? { animate: { scale: [1, 1.06, 1] }, transition: { duration: 1.1, repeat: Infinity, ease: "easeInOut" } }
    : BODY_MOTION[safeMood];

  return (
    <div role="img" aria-label={`Tulasi mascot — mood: ${MOOD_LABELS[safeMood]}`} className={className}>
      <motion.svg viewBox="0 0 120 120" className="h-full w-full" animate={body.animate} transition={body.transition} aria-hidden="true">
        <defs>
          <radialGradient id="tulasiGlow" cx="50%" cy="42%" r="60%">
            <stop offset="0%" stopColor={GLOWS[safeMood]} stopOpacity="0.9" />
            <stop offset="100%" stopColor={GLOWS[safeMood]} stopOpacity="0" />
          </radialGradient>
        </defs>

        <circle cx="60" cy="55" r="52" fill="url(#tulasiGlow)" />

        <motion.path
          d="M60,8 C92,24 104,46 104,62 C104,90 82,110 60,116 C38,110 16,90 16,62 C16,46 28,24 60,8 Z"
          animate={{ fill: LEAF_TINTS[safeMood] }}
          transition={{ duration: 0.4, ease: "easeInOut" }}
          stroke="#3E6B4C"
          strokeWidth="2"
        />
        <path d="M60,110 L60,120" stroke="#3E6B4C" strokeWidth="3" strokeLinecap="round" />
        <path d="M60,22 Q57,64 60,102" stroke="#3E6B4C" strokeWidth="1.5" strokeOpacity="0.5" fill="none" />
        <path d="M60,42 Q72,46 80,54" stroke="#3E6B4C" strokeWidth="1.2" strokeOpacity="0.4" fill="none" />
        <path d="M60,42 Q48,46 40,54" stroke="#3E6B4C" strokeWidth="1.2" strokeOpacity="0.4" fill="none" />

        <AnimatePresence>
          <motion.g
            key={safeMood}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.35, ease: "easeInOut" }}
          >
            <Face mood={safeMood} />
          </motion.g>
        </AnimatePresence>
      </motion.svg>
    </div>
  );
}
