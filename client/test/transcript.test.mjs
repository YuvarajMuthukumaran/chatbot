import { test } from "node:test";
import assert from "node:assert";
import {
  toSaved,
  fromSaved,
  sameConversation,
  RECORDS_PLACEHOLDER,
  STALE_STEP_MS,
  MAX_SAVED_MESSAGES,
} from "../src/lib/transcript.js";

const now = 1_800_000_000_000;

test("a saved conversation loads back as it was", () => {
  const messages = [
    { role: "model", text: "Hi, I'm Tulasi", greeting: true },
    { role: "user", text: "I've been anxious" },
    { role: "model", text: "That sounds hard.", doctors: [{ name: "Dr. Pooja Sharma" }] },
  ];
  assert.deepEqual(fromSaved(toSaved("s1", messages, now), "s1", now + 1000), messages);
});

test("it only loads for the same session", () => {
  const saved = toSaved("s1", [{ role: "user", text: "hi" }], now);
  assert.equal(fromSaved(saved, "s2", now), null);
  assert.equal(fromSaved(null, "s1", now), null);
});

test("a message still being typed out isn't saved half-finished", () => {
  const saved = toSaved("s1", [{ role: "user", text: "hi" }, { role: "model", text: "Hel", pending: true }], now);
  assert.equal(saved.messages.length, 1);
});

test("hospital records are shown but saved only as a privacy note", () => {
  const saved = toSaved(
    "s1",
    [{ role: "model", text: "Diagnosis: Generalized anxiety", functional: true, sensitive: true, quickReplies: ["My visit history"] }],
    now
  );
  assert.equal(saved.messages[0].text, RECORDS_PLACEHOLDER);
  assert.ok(!JSON.stringify(saved).includes("Generalized anxiety"));
  // Saving the saved form again changes nothing (no endless rewrites between tabs).
  assert.ok(sameConversation(saved, toSaved("s1", saved.messages, now + 5000)));
});

test("a booking step's buttons are dropped once the step has gone stale", () => {
  const step = { role: "model", text: "Which time works for you?", functional: true, quickReplies: ["10:00 AM", "Never mind"] };
  const saved = toSaved("s1", [{ role: "user", text: "book with dr pooja" }, step], now);
  assert.deepEqual(fromSaved(saved, "s1", now + 60_000).at(-1).quickReplies, step.quickReplies, "fresh: kept");
  assert.equal(fromSaved(saved, "s1", now + STALE_STEP_MS + 1).at(-1).quickReplies, undefined, "stale: dropped");
});

test("very long histories are trimmed to the newest messages", () => {
  const many = Array.from({ length: MAX_SAVED_MESSAGES + 25 }, (_, i) => ({ role: i % 2 ? "model" : "user", text: `m${i}` }));
  const saved = toSaved("s1", many, now);
  assert.equal(saved.messages.length, MAX_SAVED_MESSAGES);
  assert.equal(saved.messages.at(-1).text, `m${MAX_SAVED_MESSAGES + 24}`);
});
