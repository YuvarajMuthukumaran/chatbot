// Runs the real HMS flow and HTTP client against a local stub shaped like the
// hospital's API — including API-1's "register on a miss" behavior, which is
// what made unverified lookups look verified.
import { test, after, beforeEach } from "node:test";
import assert from "node:assert";
import http from "node:http";

const RESPONSES = {
  admissionStatusPush: {
    status: "ok",
    message: "Patient admission data found",
    data: { admission_status: "Admitted", ward: "General Ward", care_team: "Dr. Example", admitting_complaint: "Fever", visit_date: "2026-09-23 10:30:00" },
  },
  prescriptionSync: {
    status: "ok",
    message: "Prescription data found",
    data: { prescriptions: [{ visit_date: "2026-09-23", diagnosis: "Viral Fever", treatment: "Paracetamol", advice: "Take adequate rest" }] },
  },
  dischargeSummaryPush: {
    status: "ok",
    message: "Discharge summary found",
    data: { admission_status: "Discharged", diagnosis: "Fever", discharge_summary: "Stable." },
  },
};

let requests = [];
const stub = http.createServer((req, res) => {
  let raw = "";
  req.on("data", (chunk) => (raw += chunk));
  req.on("end", () => {
    const endpoint = req.url.split("/").pop();
    const body = JSON.parse(raw || "{}");
    requests.push({ endpoint, body });
    let payload = RESPONSES[endpoint];
    if (endpoint === "patientdata") {
      const known = body.name === "Asha" && body.l_name === "Verma" && body.phone === "9999999999";
      payload = known
        ? { status: "ok", statusCode: "yes", message: "Existing patient found", data: { uhid: "2024RG247", patient_id: "254" } }
        : { status: "ok", statusCode: "yes", message: "New patient registered", data: { uhid: "2026-NEW-1", patient_id: "9999" } };
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(payload));
  });
});
await new Promise((resolve) => stub.listen(0, resolve));
process.env.HMS_API_BASE = `http://localhost:${stub.address().port}/hms/api`;

// Imported only now, since hmsClient.js reads HMS_API_BASE when it loads.
const { handleHmsTurn } = await import("../lib/hmsFlow.js");
const { handleDeterministicTurn } = await import("../lib/turnRouter.js");

after(() => stub.close());
beforeEach(() => {
  requests = [];
});

async function converse(session, messages, ctx = {}) {
  let result;
  for (const message of messages) result = await handleDeterministicTurn(session, message, ctx);
  return result;
}

test("a real match shows the records, with the other record types one tap away", async () => {
  const session = {};
  const prompt = await converse(session, ["show my prescriptions"]);
  assert.ok(!prompt.sensitive, "the identity questions themselves aren't sensitive");
  const result = await converse(session, ["Asha Verma", "34", "+91 99999 99999"]);
  assert.match(result.reply, /Here are your most recent prescriptions/);
  assert.match(result.reply, /check with your doctor before changing or stopping/);
  assert.equal(result.functional, true);
  assert.equal(result.sensitive, true, "verified records are flagged so the client won't save them on the device");
  assert.ok(result.quickReplies.includes("My discharge summary"));
  assert.ok(!result.quickReplies.includes("My prescriptions"));

  // Verified for the rest of the session — no second identity check.
  requests = [];
  const next = await converse(session, ["My discharge summary"]);
  assert.match(next.reply, /discharge summary I found/);
  assert.deepEqual(requests.map((r) => r.endpoint), ["dischargeSummaryPush"]);
});

test("a newly *registered* record is not treated as verification", async () => {
  // API-1 creates a patient when nothing matches and returns its UHID; that
  // used to count as "verified" and show an empty brand-new record.
  const session = {};
  const result = await converse(session, ["admission status", "Asha Varma", "34", "9999999999"]);
  assert.match(result.reply, /couldn't find a matching patient record/);
  assert.equal(session.hms.verified, false);
  assert.ok(!requests.some((r) => r.endpoint === "admissionStatusPush"), "no records fetched for an unverified person");
});

test("verification locks after three failed attempts", async () => {
  const session = {};
  for (let i = 0; i < 3; i++) await converse(session, ["admission status", "Someone Else", "30", "9000000000"]);
  requests = [];
  const locked = await converse(session, ["admission status"]);
  assert.match(locked.reply, /can't try verifying again/);
  assert.equal(requests.length, 0);
});

test("verification attempts are rate limited per client", async () => {
  const ctx = { ip: "198.51.100.23" };
  let result;
  for (let i = 0; i < 9; i++) result = await converse({}, ["admission status", "Someone Else", "30", "9000000000"], ctx);
  assert.match(result.reply, /too many verification attempts/);
});

test("the name step rejects things that aren't names", async () => {
  const session = {};
  await converse(session, ["show my prescriptions"]);
  const result = await converse(session, ["why do you need that?"]);
  assert.match(result.reply, /Just your full name/);
  assert.equal(session.hms.collecting, "name");
});

test("dates from the HMS are shown in a friendly format", async () => {
  const result = await converse({}, ["admission status", "my name is Asha Verma", "34", "9999999999"]);
  assert.match(result.reply, /23 Sep/);
  assert.match(result.reply, /10:30 AM/);
});

test("registration is handed to the front desk, never done from chat", async () => {
  const result = await handleHmsTurn({}, "register me as a patient");
  assert.match(result.reply, /can't register new patients from this chat/);
  assert.equal(requests.length, 0, "no call that could create a hospital record");
});

test("a new records request mid-verification restarts it instead of becoming the name", async () => {
  const session = {};
  await converse(session, ["show my prescriptions"]);
  const result = await converse(session, ["actually my discharge summary"]);
  assert.match(result.reply, /verify it's really you/);
  assert.equal(session.hms.pendingIntent, "discharge");
});

test("asking to book mid-verification switches to booking", async () => {
  const session = {};
  await converse(session, ["show my prescriptions"]);
  const result = await converse(session, ["book an appointment"]);
  assert.equal(session.hms.collecting, null);
  assert.equal(session.booking.flow, "book");
  assert.doesNotMatch(result.reply, /how old are you/);
});
