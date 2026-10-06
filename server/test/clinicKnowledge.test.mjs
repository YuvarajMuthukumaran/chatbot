import { test } from "node:test";
import assert from "node:assert";
import { findClinicTopics, buildClinicFactsNote, CLINIC_TOPICS, CLINIC_PHONE } from "../lib/clinicKnowledge.js";
import { detectHmsIntent } from "../lib/hmsIntent.js";
import { getApiKey } from "../lib/llmClient.js";
import { romanScriptNote } from "../lib/conversationCues.js";

const ids = (message, recent) => findClinicTopics(message, recent).map((t) => t.id);

test("practical questions from real front-desk calls find their topic", () => {
  assert.deepStrictEqual(ids("I want admission for my father, he drinks a lot"), ["admission", "services"]);
  assert.deepStrictEqual(ids("what is the cost of single room"), ["room_charges"]);
  assert.deepStrictEqual(ids("how much is a consultation with a psychiatrist"), ["opd_fees"]);
  assert.deepStrictEqual(ids("where is your hospital"), ["locations"]);
  assert.deepStrictEqual(ids("OPD timings?"), ["booking_process"]);
  assert.deepStrictEqual(ids("my sister refuses to come for treatment, how can we bring her"), ["transport_unwilling"]);
  // A bare price question could be about either, so both price lists go in.
  assert.deepStrictEqual(ids("what are your charges"), ["room_charges", "opd_fees"]);
});

test("Hinglish and native-script questions match too", () => {
  assert.deepStrictEqual(ids("kitna kharcha aayega bharti ka"), ["admission", "room_charges"]);
  assert.ok(ids("papa ko daru ki aadat hai, ilaaj hai?").includes("services"));
  assert.ok(ids("शराब छुड़ाने का इलाज कहाँ होता है").includes("locations"));
  assert.ok(ids("மது பழக்கத்திற்கு சிகிச்சை எவ்வளவு").includes("room_charges"));
  assert.ok(ids("హాస్పిటల్ ఎక్కడ ఉంది").includes("locations"));
});

test("emotional messages pull in no clinic facts", () => {
  for (const message of [
    "I had a hard time today",
    "my room feels like a cage",
    "I feel so anxious about my exam tomorrow",
    "my boss treats me badly",
    "I don't know what to do anymore",
    "मुझे नहीं पता क्या करूँ",
    "nobody at home understands me",
    "I can't sleep and everything feels pointless",
  ]) {
    assert.deepStrictEqual(ids(message), [], message);
  }
});

test("a short follow-up continues the previous practical question", () => {
  assert.deepStrictEqual(ids("and for a woman?", "I want admission for my father"), ["admission"]);
  // ...but a new, unrelated message doesn't inherit it.
  assert.deepStrictEqual(ids("honestly I'm just exhausted by all of this", "I want admission for my father"), []);
});

test("the facts note quotes the verified figures and the guardrails, without source refs", () => {
  const note = buildClinicFactsNote(findClinicTopics("what is the cost of single room"));
  assert.match(note, /₹12,000/);
  assert.match(note, /medicines, blood tests/);
  assert.match(note, /Never state a price/);
  assert.ok(note.includes(CLINIC_PHONE));
  assert.doesNotMatch(note, /VN\d/);
  assert.strictEqual(buildClinicFactsNote([]), undefined);
});

test("every topic has facts and a matcher", () => {
  for (const topic of CLINIC_TOPICS) {
    assert.ok(topic.facts.length, topic.id);
    assert.strictEqual(typeof topic.match, "function", topic.id);
  }
});

test("a family asking about admission isn't sent into the patient-records flow", () => {
  assert.strictEqual(detectHmsIntent("we need hospital admission for my father"), null);
  assert.strictEqual(detectHmsIntent("what's my hospital admission status"), "admission");
  assert.strictEqual(detectHmsIntent("am I still admitted?"), "admission");
});

test("the Groq key only ever comes from the environment", () => {
  const saved = process.env.GROQ_API_KEY;
  try {
    process.env.GROQ_API_KEY = "";
    assert.strictEqual(getApiKey(), "");
    process.env.GROQ_API_KEY = "  test-key  ";
    assert.strictEqual(getApiKey(), "test-key");
  } finally {
    if (saved === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = saved;
  }
});

test("other ways families describe an unwilling relative still get the transport facts", () => {
  assert.ok(ids("my sister refuses treatment, how do we get her there?").includes("transport_unwilling"));
  assert.ok(ids("he refused all help, how should we take him to the hospital").includes("transport_unwilling"));
});

test("a discount question gets the pricing facts (which say not to invent a policy)", () => {
  const note = buildClinicFactsNote(findClinicTopics("is there any discount?"));
  assert.match(note, /No discount policy is listed/);
});

test("Hinglish typed in Roman letters asks for Roman letters back", () => {
  assert.ok(romanScriptNote("mere bhai ko admit karna hai, room ka kitna lagega?"));
  assert.ok(romanScriptNote("enaku romba kashtama irukku"));
  assert.ok(romanScriptNote("consultation fees enta untundi?"));
  assert.strictEqual(romanScriptNote("I had a really hard day"), null);
  assert.strictEqual(romanScriptNote("my papa is unwell"), null);
  assert.strictEqual(romanScriptNote("मेरे भाई को भर्ती करना है, कितना लगेगा"), null);
});
