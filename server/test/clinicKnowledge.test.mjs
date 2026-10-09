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

test("a discount question gets the pricing facts, which say never to suggest discounts", () => {
  const note = buildClinicFactsNote(findClinicTopics("is there any discount?"));
  assert.match(note, /Never bring up discounts, concessions, subsidies/);
});

test("Hinglish typed in Roman letters asks for Roman letters back", () => {
  assert.ok(romanScriptNote("mere bhai ko admit karna hai, room ka kitna lagega?"));
  assert.ok(romanScriptNote("enaku romba kashtama irukku"));
  assert.ok(romanScriptNote("consultation fees enta untundi?"));
  assert.strictEqual(romanScriptNote("I had a really hard day"), null);
  assert.strictEqual(romanScriptNote("my papa is unwell"), null);
  assert.strictEqual(romanScriptNote("मेरे भाई को भर्ती करना है, कितना लगेगा"), null);
});

test("typos, cheaper-option and missed-dose questions find their facts", () => {
  assert.deepEqual(findClinicTopics("can i get admitetd at tulasi").map((t) => t.id), ["admission"]);
  assert.ok(findClinicTopics("i want cheaper facility").length);
  assert.match(buildClinicFactsNote(findClinicTopics("i missed my dose")), /as soon as possible on 8800000255/);
  assert.deepEqual(findClinicTopics("i missed my bus"), []);
});

test("a facilities question gets verified facts for every centre, not just Gurugram", () => {
  // The exact message that used to match no topic, so the model improvised.
  const topics = findClinicTopics("I need to know what facilities are available");
  assert.deepStrictEqual(topics.map((t) => t.id), ["facilities"]);
  const note = buildClinicFactsNote(topics);
  for (const place of ["Gurugram", "Chhatarpur", "Hauz Khas", "Noida"]) assert.match(note, new RegExp(place), place);
  assert.match(note, /MUST name all of them/);
  // The model is told not to add amenities that aren't in the verified list.
  assert.match(note, /Never add anything not listed here/);
  assert.match(note, /no ambulance of its own/);
  assert.doesNotMatch(note, /VN\d/);
});

test("facilities questions in other phrasings and languages match", () => {
  for (const message of [
    "what amenities do you have",
    "facilities kya hai",
    "hospital mein kya suvidha hai",
    "अस्पताल में क्या सुविधाएं हैं",
    "என்னென்ன வசதிகள் உள்ளன",
    "ఏ సౌకర్యాలు ఉన్నాయి",
  ]) {
    assert.ok(ids(message).includes("facilities"), message);
  }
});

test("complaining that only one centre was mentioned brings back the full location list", () => {
  assert.ok(ids("Why you told only about gurugram").includes("locations"));
  assert.ok(ids("do you have any other branches?").includes("locations"));
  assert.ok(ids("is there another centre").includes("locations"));
  assert.match(buildClinicFactsNote(findClinicTopics("do you have any other branches?")), /Noida/);
});

test("a short follow-up after a facilities question keeps the facilities topic", () => {
  assert.deepStrictEqual(ids("and in delhi?", "what facilities are available"), ["locations"]);
  assert.deepStrictEqual(ids("what about for women?", "what facilities are available"), ["facilities"]);
});

test("general hospital questions always cover every centre, never only Gurugram", () => {
  for (const message of [
    "I need to know what facilities are available",
    "where is your hospital",
    "do you have any other branches?",
    "do you treat alcohol addiction",
  ]) {
    const note = buildClinicFactsNote(findClinicTopics(message));
    assert.match(note, /MUST name all of them/, message);
    for (const place of ["Gurugram", "Chhatarpur", "Hauz Khas", "Noida"]) assert.match(note, new RegExp(place), `${message} -> ${place}`);
  }
  // Admission questions say where admission happens and where the other centres fit in.
  const admission = buildClinicFactsNote(findClinicTopics("can i get admitted at tulasi"));
  for (const place of ["Gurugram", "Chhatarpur", "Hauz Khas", "Noida"]) assert.match(admission, new RegExp(place), place);
});

test("the admission guide reply mentions every centre", async () => {
  const { handleAdmissionGuideTurn, ADMISSION_START } = await import("../lib/admissionGuide.js");
  const session = {};
  handleAdmissionGuideTurn(session, ADMISSION_START);
  const { reply } = handleAdmissionGuideTurn(session, "A doctor advised admission");
  for (const place of ["Gurugram", "Chhatarpur", "Hauz Khas", "Noida"]) assert.match(reply, new RegExp(place), place);
});

test("the Noida clinic address is given exactly, in both location and facilities answers", () => {
  const address = "3rd Floor, Puma Building, BR/03, Sector 49, Noida, Uttar Pradesh 201304";
  for (const message of ["where is your noida clinic", "I need to know what facilities are available"]) {
    const note = buildClinicFactsNote(findClinicTopics(message));
    assert.ok(note.includes(address), message);
    assert.doesNotMatch(note, /never guess it|not known here/i, message);
  }
});
