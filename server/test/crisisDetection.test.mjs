import { test } from "node:test";
import assert from "node:assert";
import { detectCrisis } from "../lib/crisisDetection.js";

function assertDetects(lang, messages) {
  for (const message of messages) {
    assert.equal(detectCrisis(message), lang, `expected ${lang} crisis for: ${message}`);
  }
}

test("English — original phrases still detected", () => {
  assertDetects("en", [
    "I want to kill myself",
    "i've been thinking about suicide",
    "I feel suicidal",
    "I just want to end it all",
    "there's no reason to live",
    "everyone would be better off dead... me included",
    "I don't want to live anymore",
    "I hurt myself last night",
    "I've started cutting myself again",
    "thinking about an overdose",
    "I can't go on",
    "I want to die",
    "I wish I was dead",
  ]);
});

test("English — common variants the original list missed", () => {
  assertDetects("en", [
    "I keep thinking about killing myself",
    "i want to kms",
    "I want to unalive myself",
    "I've been thinking about ending my life",
    "nothing left to live for",
    "life is not worth living",
    "there's no point in living",
    "my family would be better off without me",
    "I don't want to exist",
    "I wish I had never been born",
    "i wish i was never born",
    "honestly i wanna die",
    "I keep hurting myself",
    "I want to go to sleep and never wake up",
    "I just want to end it",
    "I took all my pills",
    "I swallowed a bunch of sleeping pills",
  ]);
});

test("English — ordinary sentences don't trigger it", () => {
  for (const message of [
    "the clinic is about 5 kms from my house",
    "I want to end it with my boyfriend but I'm scared",
    "this traffic is killing me",
    "I'm dying to see that movie",
    "I never wake up early on Sundays",
    "can you help me book an appointment",
    "I killed it at my presentation today",
  ]) {
    assert.equal(detectCrisis(message), null, `false positive for: ${message}`);
  }
});

test("Hindi — native script, with and without nukta", () => {
  assertDetects("hi", [
    "मैं खुदकुशी करना चाहता हूं",
    "मैं मरना चाहती हूं",
    "मैं मर जाना चाहता हूं",
    "मुझे मरना है",
    "अब जीने की इच्छा नहीं है",
    "ज़िंदगी ख़त्म कर दूंगा", // with nukta
    "जिंदगी खत्म कर दूंगा", // without nukta
    "मैं जीना नहीं चाहती",
  ]);
});

test("Hindi — romanized (Hinglish)", () => {
  assertDetects("hi", [
    "main khudkushi kar lunga",
    "mujhe khudkhushi karni hai",
    "main marna chahta hu",
    "main mar jana chahti hu",
    "mujhe marna hai",
    "main jeena nahi chahti",
    "jeene ka mann nahi karta",
    "ab jine ki ichha nahi hai",
    "zindagi khatam kar dunga",
  ]);
});

test("Hindi — 'I feel like dying' phrasings found while testing the live bot", () => {
  assertDetects("hi", [
    "mujhe marne ka mann kar raha hai",
    "marne ka man karta hai",
    "kya main mar jaun?",
    "jeene ka koi matlab nahi hai",
    "मुझे मरने का मन कर रहा है",
    "जीने का कोई मतलब नहीं",
  ]);
  // Everyday hyperbole stays out.
  assert.equal(detectCrisis("hasi se mar jaunga yaar"), null);
});

test("Tamil — native script and romanized", () => {
  assertDetects("ta", [
    "தற்கொலை பண்ணிக்கலாம்னு தோணுது", // native script with a decomposable vowel sign (கொ)
    "நான் சாகணும்",
    "சாகப் போறேன்",
    "செத்துடலாம் போல இருக்கு",
    "naan saaganum",
    "sethudalam pola irukku",
    "tharkolai pannanum",
  ]);
});

test("Telugu — native script and romanized", () => {
  assertDetects("te", [
    "నాకు చనిపోవాలని ఉంది", // "I feel like dying" — missed before (stem ending varies)
    "నేను చనిపోవాలి",
    "బ్రతకాలని లేదు",
    "naaku chanipovalani undi",
    "chanipovali anipistundi",
    "bathakalani ledu",
  ]);
});

test("shared 'aatmahatya' is caught (defaults to Hindi)", () => {
  assert.equal(detectCrisis("aatmahatya"), "hi");
  assert.equal(detectCrisis("ఆత్మహత్య"), "hi");
});

test("non-strings and empty input are safe", () => {
  assert.equal(detectCrisis(""), null);
  assert.equal(detectCrisis(null), null);
  assert.equal(detectCrisis(42), null);
});

test("'went to sleep and never woke up' is caught; everyday 'didn't wake up on time' isn't", () => {
  assertDetects("en", [
    "honestly ive been thinking it would be easier for everyone if i just went to sleep and never woke up",
    "i hope i never wake up",
  ]);
  assert.equal(detectCrisis("I didnt wake up on time today"), null);
  assert.equal(detectCrisis("I slept so well I didn't wake up once"), null);
  assert.equal(detectCrisis("my alarm never woke me up"), null);
});
