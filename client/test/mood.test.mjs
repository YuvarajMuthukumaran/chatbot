import { test } from "node:test";
import assert from "node:assert";
import { detectMood } from "../src/lib/mood.js";

test("detects mood from English text", () => {
  assert.equal(detectMood("I feel very anxious"), "anxious");
  assert.equal(detectMood("I'm so happy today"), "happy");
});

test("detects mood from native-script Hindi/Tamil/Telugu", () => {
  assert.equal(detectMood("मुझे बहुत गुस्सा आ रहा है"), "angry");
  assert.equal(detectMood("எனக்கு கோபமா இருக்கு"), "angry");
});

test("detects mood from romanized (Hinglish/Tanglish/Tenglish) text", () => {
  // Regression: mood.js originally only matched native script, so romanized
  // input never changed the mascot's expression at all.
  assert.equal(detectMood("Mujhe bahut gussa aa raha hai"), "angry");
  assert.equal(detectMood("enakku romba kobam varudhu"), "angry");
  assert.equal(detectMood("naaku chala kopam vasthundi"), "angry");
  assert.equal(detectMood("mujhe bahut chinta ho rahi hai"), "anxious");
});

test("returns null for text with no mood cues", () => {
  assert.equal(detectMood("what's the weather like today"), null);
  assert.equal(detectMood("can you help me book an appointment"), null);
});
