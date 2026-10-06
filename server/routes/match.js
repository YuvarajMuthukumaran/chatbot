// POST /api/match: a three-question "find the right specialist" matcher.
// No personal data is accepted or stored: only the three answers below.
import { Router } from "express";
import { DOCTORS, SPECIALTY_LABELS } from "../lib/doctors.js";
import { createRateLimiter } from "../lib/rateLimit.js";

const router = Router();
const limiter = createRateLimiter({ windowMs: 60_000, max: 20 });

const WHO = ["self", "child", "elder", "loved"];
const SUPPORT = ["therapy", "medication", "unsure"];
// "unsure" is a valid concern too: only generalists qualify, i.e. a good first consultation.
const UNSURE = "unsure";
// Who the care is for narrows the pool: children and older adults always need a matching specialty.
const WHO_TAGS = { child: ["child_adolescent", "autism", "adhd"], elder: ["geriatric_dementia"], self: [], loved: [] };

const isPsychiatrist = (d) => /psychiatrist/i.test(d.role);
const isTherapist = (d) => /psycholog|social worker|counsel/i.test(d.role);

/** Small stable hash so ties rotate day by day instead of always favouring the top of the array. */
function dayJitter(name, now) {
  const key = `${name}|${now.toISOString().slice(0, 10)}`;
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return ((h >>> 0) % 1000) / 1000; // 0..0.999: never enough to beat a real score gap
}

/**
 * Pure and deterministic for a given day, so it is easy to unit test.
 * Pass 1 needs the concern to match (or the doctor to be a flagged generalist, who
 * fills gaps at a lower score). If nobody qualifies, pass 2 drops that requirement
 * (the "who" rule never relaxes) and the result is flagged `relaxed` for the UI.
 * @param {{ concern: string, who: string, support: string }} input
 */
export function rankDoctors({ concern, who, support }, doctors = DOCTORS, now = new Date(), limit = 3) {
  const needTags = WHO_TAGS[who] ?? [];

  const score = (d, requireConcern) => {
    const hasConcern = d.specialties.includes(concern);
    if (requireConcern && !hasConcern && !d.generalist) return null;
    const whoHits = needTags.filter((t) => d.specialties.includes(t));
    if (needTags.length && !whoHits.length) return null;

    let s = 0;
    const reasons = [];
    if (hasConcern) {
      s += 10;
      reasons.push(`Treats ${SPECIALTY_LABELS[concern] ?? concern}`);
    } else if (d.generalist) {
      s += 3;
      reasons.push("Sees a broad range of concerns");
    }
    if (whoHits.length) {
      s += 6 * whoHits.length;
      reasons.push(who === "child" ? "Works with children and teens" : "Works with older adults");
    }
    if (support === "medication" && isPsychiatrist(d)) {
      s += 4;
      reasons.push("Psychiatrist: can prescribe medication");
    }
    if (support === "therapy" && isTherapist(d)) {
      s += 4;
      reasons.push("Therapist: talking therapy");
    }
    return s > 0 ? { d, s: s + dayJitter(d.name, now), reasons } : null;
  };

  const run = (requireConcern) => doctors.map((d) => score(d, requireConcern)).filter(Boolean);
  let ranked = run(true);
  let relaxed = false;
  if (!ranked.length) {
    ranked = run(false);
    relaxed = ranked.length > 0;
  }
  ranked.sort((a, b) => b.s - a.s);
  return {
    relaxed,
    matches: ranked.slice(0, limit).map(({ d, reasons }) => ({ name: d.name, role: d.role, focus: d.focus || null, photo: d.photo || null, reasons })),
  };
}

router.post("/match", (req, res) => {
  const gate = limiter.consume(req.ip);
  if (!gate.ok) return res.set("Retry-After", String(gate.retryAfterSec)).status(429).json({ error: "Too many requests. Please try again shortly." });

  const { concern, who, support } = req.body ?? {};
  if (typeof concern !== "string" || (concern !== UNSURE && !Object.hasOwn(SPECIALTY_LABELS, concern))) return res.status(400).json({ error: "Unknown concern." });
  if (!WHO.includes(who)) return res.status(400).json({ error: `who must be one of: ${WHO.join(", ")}` });
  if (!SUPPORT.includes(support)) return res.status(400).json({ error: `support must be one of: ${SUPPORT.join(", ")}` });

  const result = rankDoctors({ concern, who, support });
  // Nobody suitable: hand over to the front desk instead of guessing.
  res.json(result.matches.length ? result : { relaxed: false, matches: [], fallback: "call" });
});

export default router;
