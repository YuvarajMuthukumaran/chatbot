import { test, before, after } from "node:test";
import assert from "node:assert";
import { app } from "../app.js";
import { DOCTORS, SPECIALTY_LABELS } from "../lib/doctors.js";
import { rankDoctors } from "../routes/match.js";

const DAY = new Date("2026-01-15T10:00:00Z");

test("every doctor is discoverable: tagged with a specialty or flagged generalist", () => {
  const invisible = DOCTORS.filter((d) => !d.specialties.length && !d.generalist).map((d) => d.name);
  assert.deepEqual(invisible, []);
});

test("every specialty tag used by a doctor has a label", () => {
  const unknown = new Set(DOCTORS.flatMap((d) => d.specialties).filter((t) => !(t in SPECIALTY_LABELS)));
  assert.deepEqual([...unknown], []);
});

test("rankDoctors: concern match beats a generalist, and generalists fill the remaining slots", () => {
  const { matches, relaxed } = rankDoctors({ concern: "ptsd", who: "self", support: "unsure" }, DOCTORS, DAY, 6);
  assert.equal(relaxed, false);
  assert.equal(matches[0].name, "Dr. Ichpreet Singh"); // the only PTSD-tagged doctor
  assert.ok(matches.slice(1).every((m) => m.reasons.includes("Sees a broad range of concerns")));
});

test("rankDoctors: children only ever get child specialists (generalists need the child tag too)", () => {
  const { matches } = rankDoctors({ concern: "anxiety", who: "child", support: "unsure" }, DOCTORS, DAY, 50);
  assert.ok(matches.length > 0);
  for (const m of matches) {
    const d = DOCTORS.find((x) => x.name === m.name);
    assert.ok(d.specialties.some((t) => ["child_adolescent", "autism", "adhd"].includes(t)), `${m.name} has no child specialty`);
  }
  assert.ok(!matches.some((m) => m.name === "Dr. Anu Yadav")); // generalist without a child tag
});

test("rankDoctors: older adults only get geriatric specialists", () => {
  const { matches } = rankDoctors({ concern: "depression", who: "elder", support: "unsure" }, DOCTORS, DAY, 50);
  assert.ok(matches.length > 0);
  assert.ok(matches.every((m) => DOCTORS.find((d) => d.name === m.name).specialties.includes("geriatric_dementia")));
});

test("rankDoctors: asking for medication prefers psychiatrists, therapy prefers therapists", () => {
  const med = rankDoctors({ concern: "anxiety", who: "self", support: "medication" }, DOCTORS, DAY);
  assert.ok(/psychiatrist/i.test(med.matches[0].role));
  const talk = rankDoctors({ concern: "anxiety", who: "self", support: "therapy" }, DOCTORS, DAY);
  assert.ok(!/psychiatrist/i.test(talk.matches[0].role));
});

test("rankDoctors: an unsure concern only offers generalists (a good first consultation)", () => {
  const { matches } = rankDoctors({ concern: "unsure", who: "self", support: "unsure" }, DOCTORS, DAY);
  assert.ok(matches.length > 0);
  assert.ok(matches.every((m) => DOCTORS.find((d) => d.name === m.name).generalist));
});

test("rankDoctors: no one qualifies -> empty without guessing", () => {
  const r = rankDoctors({ concern: "anxiety", who: "child", support: "unsure" }, [{ name: "X", role: "Psychiatrist", specialties: ["ocd"] }], DAY);
  assert.deepEqual(r.matches, []);
});

let server;
let base;
before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://localhost:${server.address().port}/api`;
});
after(() => server.close());
const post = (body) => fetch(`${base}/match`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

test("POST /api/match returns ranked doctors for valid answers", async () => {
  const res = await post({ concern: "anxiety", who: "self", support: "medication" });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(data.matches.length > 0 && data.matches.length <= 3);
  assert.ok(data.matches[0].reasons.length > 0);
});

test("POST /api/match rejects bad input", async () => {
  assert.equal((await post({ concern: "nonsense", who: "self", support: "therapy" })).status, 400);
  assert.equal((await post({ concern: "__proto__", who: "self", support: "therapy" })).status, 400);
  assert.equal((await post({ concern: "anxiety", who: "pet", support: "therapy" })).status, 400);
  assert.equal((await post({ concern: "anxiety", who: "self", support: "x" })).status, 400);
  assert.equal((await post({})).status, 400);
  assert.equal((await post({ concern: "unsure", who: "self", support: "unsure" })).status, 200);
});
