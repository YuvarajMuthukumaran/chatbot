import { test } from "node:test";
import assert from "node:assert";
import {
  matchSpecialties,
  wantsDoctorHelp,
  getDoctorsForSpecialties,
  getGeneralistDoctor,
  DOCTORS,
} from "../lib/doctors.js";

test("wantsDoctorHelp — explicit asks and real distress trigger it", () => {
  assert.equal(wantsDoctorHelp("best doctor for anxiety"), true);
  assert.equal(wantsDoctorHelp("i feel anxious all the time"), true);
  assert.equal(wantsDoctorHelp("i always feel so overwhelmed"), true);
});

test("wantsDoctorHelp — merely naming a feeling once does not trigger it", () => {
  assert.equal(wantsDoctorHelp("i feel very anxious"), false);
  assert.equal(wantsDoctorHelp("i feel very sad"), false);
});

test("wantsDoctorHelp — meta-commentary about the bot's own behavior doesn't trigger the fuzzy fallback", () => {
  assert.equal(wantsDoctorHelp("why do you always suggest grounding for everything"), false);
  assert.equal(wantsDoctorHelp("do you always do this"), false);
  // ...but an explicit ask inside the same message still overrides it.
  assert.equal(wantsDoctorHelp("why do you always ask the same thing, i really need a doctor"), true);
});

test("matchSpecialties — recognizes tagged conditions", () => {
  assert.deepEqual(matchSpecialties("best doctor for ocd"), ["ocd"]);
  assert.ok(matchSpecialties("i have insomnia and cant sleep").includes("sleep_disorder"));
  assert.ok(matchSpecialties("having marriage problems").includes("relationship"));
});

test("matchSpecialties — untagged concerns (e.g. aggression) return no tags", () => {
  assert.deepEqual(matchSpecialties("best doctor for aggression"), []);
});

test("getGeneralistDoctor — falls back to Dr. Anu Yadav for untagged concerns", () => {
  const result = getGeneralistDoctor();
  assert.equal(result.length, 1);
  assert.equal(result[0].name, "Dr. Anu Yadav");
});

test("getDoctorsForSpecialties — every doctor referenced has non-empty specialties matching a real INTENT_PATTERNS tag", () => {
  // Guards against a typo'd specialty tag silently never matching anyone.
  const allTags = new Set();
  for (const d of DOCTORS) for (const s of d.specialties) allTags.add(s);
  for (const tag of allTags) {
    const matches = getDoctorsForSpecialties([tag], 50);
    assert.ok(matches.length > 0, `no doctor found for tag "${tag}" even though it's used in DOCTORS`);
  }
});
