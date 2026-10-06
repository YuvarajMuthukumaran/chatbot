import { test } from "node:test";
import assert from "node:assert";
import { ASSESSMENTS, detectAssessmentIntent, parseAnswer } from "../lib/assessments.js";
import { handleDeterministicTurn } from "../lib/turnRouter.js";

const { ocd, depression, anxiety, adhd, alcohol, dizziness } = ASSESSMENTS;

async function converse(session, messages) {
  let result;
  for (const message of messages) result = await handleDeterministicTurn(session, message);
  return result;
}

test("asking whether you have a condition starts the matching screening", () => {
  assert.strictEqual(detectAssessmentIntent("i think i have ocd"), "ocd");
  assert.strictEqual(detectAssessmentIntent("Do I have depression?"), "depression");
  assert.strictEqual(detectAssessmentIntent("am I depressed or just tired"), "depression");
  assert.strictEqual(detectAssessmentIntent("is this anxiety?"), "anxiety");
  assert.strictEqual(detectAssessmentIntent("I might have ADHD"), "adhd");
  assert.strictEqual(detectAssessmentIntent("is my drinking a problem"), "alcohol");
  assert.strictEqual(detectAssessmentIntent("I feel dizzy"), "dizziness");
  assert.strictEqual(detectAssessmentIntent("mujhe chakkar aa raha hai"), "dizziness");
  assert.strictEqual(detectAssessmentIntent("mujhe ocd hai kya"), "ocd");
});

test("talking about a condition you already know you have doesn't start a quiz", () => {
  assert.strictEqual(detectAssessmentIntent("my OCD is really bad today"), null);
  assert.strictEqual(detectAssessmentIntent("my depression is back"), null);
  assert.strictEqual(detectAssessmentIntent("do I have to add sugar"), null);
  assert.strictEqual(detectAssessmentIntent("I feel sad"), null);
});

test("answers can be tapped, numbered, or typed as yes/no in several languages", () => {
  const q = dizziness.questions[0];
  assert.strictEqual(parseAnswer(q, "Yes").value, 1);
  assert.strictEqual(parseAnswer(q, "haan").value, 1);
  assert.strictEqual(parseAnswer(q, "nahi").value, 0);
  assert.strictEqual(parseAnswer(q, "2").value, 0);
  assert.strictEqual(parseAnswer(depression.questions[0], "nearly every day").value, 3);
  assert.strictEqual(parseAnswer(depression.questions[0], "several").value, 1);
  assert.strictEqual(parseAnswer(depression.questions[0], "pizza"), null);
});

test("OCD: OCI-4 of 4+ with real impact is 'Likely'; without signs it's 'Unlikely'", () => {
  assert.strictEqual(ocd.score([2, 1, 0, 2, 1, 1]).likelihood, "likely");
  assert.strictEqual(ocd.score([2, 1, 0, 2, 0, 0]).likelihood, "possible");
  assert.strictEqual(ocd.score([0, 1, 0, 0, 0, 0]).likelihood, "low");
});

test("PHQ-9 and GAD-7 follow the published cut-offs; PHQ-9 item 9 always flags crisis support", () => {
  assert.strictEqual(depression.score([1, 1, 1, 1, 0, 0, 0, 0, 0]).label, "Unlikely");
  assert.strictEqual(depression.score([1, 1, 1, 1, 1, 0, 0, 0, 0]).label, "Possible · mild");
  assert.strictEqual(depression.score([2, 2, 2, 2, 2, 0, 0, 0, 0]).label, "Likely · moderate");
  assert.strictEqual(depression.score([3, 3, 3, 3, 3, 3, 2, 0, 0]).label, "Likely · severe");
  const minimalButAtRisk = depression.score([0, 0, 0, 0, 0, 0, 0, 0, 1]);
  assert.strictEqual(minimalButAtRisk.crisis, true);
  assert.strictEqual(minimalButAtRisk.suggestDoctors, true);
  assert.strictEqual(anxiety.score([3, 2, 0, 0, 0, 0, 0]).label, "Possible · mild");
  assert.strictEqual(anxiety.score([3, 3, 3, 3, 3, 0, 0]).label, "Likely · severe");
});

test("ASRS: four shaded answers or more is 'Likely'", () => {
  assert.strictEqual(adhd.score([2, 2, 2, 3, 0, 0]).likelihood, "likely");
  assert.strictEqual(adhd.score([2, 2, 2, 2, 2, 2]).likelihood, "possible"); // items 4–6 need "Often"
  assert.strictEqual(adhd.score([1, 1, 1, 1, 1, 1]).likelihood, "low");
});

test("AUDIT-C: 'Never' ends it; 4+ is risky, 8+ likely harmful", () => {
  assert.ok(alcohol.stopAfter([0], 0));
  assert.strictEqual(alcohol.score([0]).label, "Not drinking");
  assert.strictEqual(alcohol.score([2, 1, 1]).likelihood, "possible");
  assert.strictEqual(alcohol.score([4, 3, 2]).likelihood, "likely");
});

test("dizziness: any danger sign stops and says to get emergency help", async () => {
  const session = {};
  await converse(session, ["I feel dizzy"]);
  const result = await converse(session, ["Yes"]);
  assert.strictEqual(result.assessment.likelihood, "urgent");
  assert.match(result.reply, /112/);
  assert.strictEqual(result.crisis, true);
  assert.strictEqual(session.assessment, null);
});

test("dizziness: common triggers are named as the likely causes", async () => {
  const session = {};
  const result = await converse(session, [
    "I feel dizzy",
    "No",
    "Light-headed, like I might faint",
    "When I stand up quickly",
    "Not really",
    "No",
    "No",
    "Just today",
  ]);
  const { points, likelihood } = result.assessment;
  assert.strictEqual(likelihood, "low");
  assert.ok(points.some((p) => /blood pressure/.test(p)));
  assert.ok(points.some((p) => /food or water/.test(p)));
});

test("the whole OCD conversation runs in the chat: progress, a result card, and doctors", async () => {
  const session = {};
  const first = await converse(session, ["i think i have ocd"]);
  assert.match(first.reply, /6 quick questions/);
  assert.deepStrictEqual(first.progress, { title: "OCD screening", current: 1, total: 6 });
  assert.ok(first.quickReplies.includes("A lot"));
  assert.ok(first.quickReplies.includes("Stop"));
  assert.strictEqual(first.functional, true, "kept private from the model");

  const result = await converse(session, ["A lot", "Moderately", "Not at all", "A lot", "1–3 hours", "Somewhat"]);
  assert.strictEqual(result.assessment.label, "Likely");
  assert.ok(result.doctors.length > 0);
  assert.match(result.doctors[0].role, /psychiatrist/i, "a likely result puts a psychiatrist first");
  assert.match(result.llmNote, /not a diagnosis/);
  assert.strictEqual(session.assessment, null);
});

test("a screening can be stopped, re-asks on an unclear answer, and steps aside for booking", async () => {
  const stopped = await converse({}, ["do I have anxiety", "stop"]);
  assert.match(stopped.reply, /stopped the questions/);

  const unclear = await converse({}, ["do I have anxiety", "pizza"]);
  assert.match(unclear.reply, /pick one of the options/);

  const session = {};
  await converse(session, ["do I have anxiety"]);
  const booking = await converse(session, ["book an appointment"]);
  assert.strictEqual(session.assessment, null);
  assert.match(booking.reply, /who would you like to see/i);
});

test("an answer that sounds like a feeling still counts as an answer", async () => {
  const session = {};
  const result = await converse(session, ["I feel dizzy", "No", "Hard to describe", "When I'm stressed or anxious"]);
  assert.ok(session.assessment, "still in the screening");
  assert.match(result.reply, /eaten/);
});

test("crisis language mid-screening still gets the crisis reply first", async () => {
  const session = {};
  const result = await converse(session, ["am I depressed", "I want to kill myself"]);
  assert.strictEqual(result.crisis, true);
  assert.strictEqual(session.assessment, null);
});

test("the website widget never runs a screening", async () => {
  const result = await converse({ channel: "website" }, ["i think i have ocd"]);
  assert.strictEqual(result.handled, false);
});
