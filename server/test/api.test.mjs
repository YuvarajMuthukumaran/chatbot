// End-to-end over HTTP: the real Express app on a throwaway port, backed by
// the in-memory fake database. No test here sends a message that would reach
// the LLM, and the key is cleared so one that slipped through couldn't call
// Groq for real.
import { test, before, after } from "node:test";
import assert from "node:assert";
import { createFakeDb } from "../scripts/fakeDb.js";
import { setDb } from "../lib/db.js";
import { app } from "../app.js";
import { clinicToday, addDays } from "../lib/clinicTime.js";

process.env.GROQ_API_KEY = "";
delete process.env.ADMIN_TOKEN;
// Never the hospital's real HMS from tests (it creates a patient record on
// every unmatched lookup) — a dead local address makes sure of it.
process.env.HMS_API_BASE = "http://127.0.0.1:9/hms/api";

let server;
let base;
let doctorId;

before(async () => {
  const db = createFakeDb();
  await setDb(db);
  const { insertedId } = await db.collection("doctors").insertOne({ name: "Dr. Pooja Sharma", role: "Consultant Psychiatrist", specialties: ["anxiety"] });
  await db.collection("doctors").insertOne({ name: "Dr. (Col.) Pavan Kumar Pardal", role: "Senior Consultant Psychiatrist", specialties: ["ocd"] });
  doctorId = String(insertedId);
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://localhost:${server.address().port}/api`;
});

after(() => server.close());

const json = (method, body) => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

async function newSession() {
  const res = await fetch(`${base}/session`, json("POST", {}));
  return (await res.json()).sessionId;
}

/** Posts a chat message and collects the SSE events. */
async function chat(sessionId, message) {
  const res = await fetch(`${base}/chat`, json("POST", { sessionId, message }));
  if (!res.headers.get("content-type")?.includes("text/event-stream")) return { status: res.status, body: await res.json() };
  const raw = await res.text();
  const events = raw
    .split("\n\n")
    .map((e) => e.replace(/^data: /, "").trim())
    .filter(Boolean);
  assert.equal(events.at(-1), "[DONE]");
  return { status: res.status, events: events.slice(0, -1).map((e) => JSON.parse(e)) };
}

test("a doctor search that isn't a valid regex no longer takes the server down", async () => {
  for (const search of ["(", "[", "*+?", "a\\"]) {
    const res = await fetch(`${base}/doctors?search=${encodeURIComponent(search)}`);
    assert.equal(res.status, 200, search);
  }
  const paren = await (await fetch(`${base}/doctors?search=${encodeURIComponent("(Col.)")}`)).json();
  assert.equal(paren.count, 1);
  assert.equal((await fetch(`${base}/health`)).status, 200, "still up");
});

test("query-string objects are ignored rather than passed to the database", async () => {
  const res = await fetch(`${base}/doctors?specialty[$ne]=x`);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).count, 2, "treated as no filter, not as a $ne operator");
});

test("basic security headers are set", async () => {
  const res = await fetch(`${base}/health`);
  assert.equal(res.headers.get("x-content-type-options"), "nosniff");
  assert.equal(res.headers.get("x-frame-options"), "DENY");
  assert.equal(res.headers.get("x-powered-by"), null);
});

test("the doctor import endpoint is locked without an admin token", async () => {
  const res = await fetch(`${base}/doctors/import`, { method: "POST" });
  assert.equal(res.status, 403);
});

test("malformed JSON gets a 400, not a 500", async () => {
  const res = await fetch(`${base}/session`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{oops" });
  assert.equal(res.status, 400);
});

test("a restored conversation fits the request limit even in a 3-byte script", async () => {
  // The client sends at most 20 turns of 1500 characters when restoring.
  const turn = "நான் ".repeat(300).slice(0, 1500);
  const history = Array.from({ length: 20 }, (_, i) => ({ role: i % 2 ? "model" : "user", text: turn }));
  const res = await fetch(`${base}/session`, json("POST", { history }));
  assert.equal(res.status, 200);
});

test("chat — crisis replies are deterministic and flagged", async () => {
  const sessionId = await newSession();
  const { events } = await chat(sessionId, "I want to end my life");
  assert.equal(events.length, 1);
  assert.equal(events[0].crisis, true);
  assert.match(events[0].text, /8800000255/);
  // Never the clinic line alone: a 24/7 helpline and 112 are always there too.
  assert.match(events[0].text, /14416/);
  assert.match(events[0].text, /112/);
});

test("chat — booking replies carry quick replies", async () => {
  const sessionId = await newSession();
  const { events } = await chat(sessionId, "book an appointment");
  assert.equal(events[0].functional, true);
  assert.ok(events[0].quickReplies.includes("Anxiety"));
});

test("chat — oversized messages and unknown sessions are rejected cleanly", async () => {
  const sessionId = await newSession();
  assert.equal((await chat(sessionId, "x".repeat(2001))).status, 413);
  assert.equal((await chat("no-such-session", "hello")).status, 404);
});

test("appointments — the server validates bookings itself", async () => {
  const tomorrow = addDays(clinicToday(), 1);
  const booking = { doctorId, doctorName: "Someone Else Entirely", patientName: "Priya Sharma", patientPhone: "9876543210", date: tomorrow, time: "10:00" };

  const past = await fetch(`${base}/appointments`, json("POST", { ...booking, date: addDays(clinicToday(), -1) }));
  assert.equal(past.status, 400);
  const offGrid = await fetch(`${base}/appointments`, json("POST", { ...booking, time: "10:15" }));
  assert.equal(offGrid.status, 409);
  const unknownDoctor = await fetch(`${base}/appointments`, json("POST", { ...booking, doctorId: "000000000000000000000000" }));
  assert.equal(unknownDoctor.status, 404);

  const created = await fetch(`${base}/appointments`, json("POST", booking));
  assert.equal(created.status, 201);
  const { appointment } = await created.json();
  assert.equal(appointment.doctorName, "Dr. Pooja Sharma", "the name comes from the doctor record, not the request");
  assert.equal(appointment.patientPhone, undefined, "responses leave out the phone number");

  const again = await fetch(`${base}/appointments`, json("POST", booking));
  assert.equal(again.status, 409, "no double booking");

  const slots = await (await fetch(`${base}/appointments/slots?doctorId=${doctorId}&date=${tomorrow}`)).json();
  assert.ok(!slots.slots.includes("10:00"));
});

test("appointments — phone lookups return only what the page needs, and are rate limited", async () => {
  const first = await fetch(`${base}/appointments?phone=${encodeURIComponent("+91 98765 43210")}`);
  assert.equal(first.status, 200);
  const { appointments } = await first.json();
  assert.deepEqual(Object.keys(appointments[0]).sort(), ["_id", "date", "doctorId", "doctorName", "status", "time"]);

  let res;
  for (let i = 0; i < 15; i++) res = await fetch(`${base}/appointments?phone=9876543210`);
  assert.equal(res.status, 429);
  assert.ok(res.headers.get("retry-after"));
});
