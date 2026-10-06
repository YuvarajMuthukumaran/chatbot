import { test } from "node:test";
import assert from "node:assert";
import {
  matchSpecialties,
  wantsDoctorHelp,
  doctorHelpReason,
  getDoctorsForSpecialties,
  getGeneralistDoctor,
  SPECIALTY_LABELS,
  DOCTORS,
} from "../lib/doctors.js";
import { detectHmsIntent } from "../lib/hmsIntent.js";

test("wantsDoctorHelp — explicit asks and real distress trigger it", () => {
  assert.equal(wantsDoctorHelp("best doctor for anxiety"), true);
  assert.equal(wantsDoctorHelp("i feel anxious all the time"), true);
  assert.equal(wantsDoctorHelp("i always feel so overwhelmed"), true);
});

test("wantsDoctorHelp — merely naming a feeling once does not trigger it", () => {
  assert.equal(wantsDoctorHelp("i feel very anxious"), false);
  assert.equal(wantsDoctorHelp("i feel very sad"), false);
});

test("one hard day is heard, not referred — only distress that keeps coming up counts", () => {
  assert.equal(wantsDoctorHelp("I had a really hard day, everything feels heavy"), false);
  assert.equal(wantsDoctorHelp("I'm so exhausted"), false);
  assert.equal(wantsDoctorHelp("I'm worried about tomorrow"), false);
  assert.equal(doctorHelpReason("I'm so exhausted", ["work has been really hard lately"]), "concern");
  assert.equal(doctorHelpReason("I'm so exhausted", ["hey", "I watched a movie"]), null);
});

test("ongoing or worsening distress, and asks for treatment, still count on their own", () => {
  assert.equal(doctorHelpReason("it's been getting worse for months"), "concern");
  assert.equal(doctorHelpReason("I can't cope anymore"), "concern");
  assert.equal(doctorHelpReason("we need admission for my father"), "explicit");
  assert.equal(doctorHelpReason("papa ka ilaaj karwana hai"), "explicit");
  assert.equal(doctorHelpReason("मेरे भाई का इलाज कहाँ होगा"), "explicit");
});

test("mentioning a doctor they already have isn't asking for one", () => {
  assert.equal(doctorHelpReason("my doctor started me on sertraline, what side effects should I expect?"), null);
  assert.equal(doctorHelpReason("the psychiatrist said to keep taking it"), null);
  assert.equal(doctorHelpReason("I need a doctor, my old doctor retired"), "explicit");
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

test("every specialty tag has a human-readable label", () => {
  const tags = new Set(DOCTORS.flatMap((d) => d.specialties));
  for (const tag of ["sleep_disorder", "phobia", "trauma"]) tags.add(tag); // matchable, even if no one is tagged yet
  for (const tag of tags) assert.ok(SPECIALTY_LABELS[tag], `no label for "${tag}"`);
});

test("HMS intents — a bare 'my appointments' is no longer claimed as visit history", () => {
  assert.equal(detectHmsIntent("show my appointments"), null);
  assert.equal(detectHmsIntent("my last 5 visits"), "visits");
  assert.equal(detectHmsIntent("Show my visit history"), "visits");
  assert.equal(detectHmsIntent("cancel my appointment"), null);
  // "new patient" alone shows up in ordinary booking requests.
  assert.equal(detectHmsIntent("I'm a new patient, can I book with dr anu"), null);
  assert.equal(detectHmsIntent("register me as a patient"), "register");
});
