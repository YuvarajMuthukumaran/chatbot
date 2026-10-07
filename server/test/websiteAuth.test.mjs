// Website additions: phone-OTP login, the signed-in patient's own
// appointments, and the website chat channel (no booking/records in chat).
// Real Express app on a throwaway port, in-memory database; no test sends a
// message that would reach the LLM.
import { test, before, after } from "node:test";
import assert from "node:assert";
import { createFakeDb } from "../scripts/fakeDb.js";
import { setDb } from "../lib/db.js";
import { app } from "../app.js";
import { clinicToday, addDays } from "../lib/clinicTime.js";

process.env.OTP_DEV_ECHO = "true";
process.env.HMS_API_BASE = "http://127.0.0.1:9/hms/api";

let server, base, doctorId, db;

before(async () => {
  db = createFakeDb();
  await setDb(db);
  const { insertedId } = await db.collection("doctors").insertOne({ name: "Dr. Pooja Sharma", role: "Consultant Psychiatrist", specialties: ["anxiety"] });
  doctorId = String(insertedId);
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://localhost:${server.address().port}/api`;
});
after(() => server.close());

const json = (method, body, headers = {}) => ({ method, headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
const cookieOf = (res) => res.headers.get("set-cookie")?.split(";")[0];

async function login(phone) {
  const r1 = await (await fetch(`${base}/auth/otp/request`, json("POST", { phone }))).json();
  const res = await fetch(`${base}/auth/otp/verify`, json("POST", { phone, code: r1.devCode }));
  assert.equal(res.status, 200);
  return cookieOf(res);
}

test("OTP login sets an httpOnly session cookie and /auth/me reads it", async () => {
  const cookie = await login("98765 43210");
  assert.match(cookie, /^thc_session=/);
  const me = await fetch(`${base}/auth/me`, { headers: { cookie } });
  assert.equal(me.status, 200);
  assert.deepEqual(await me.json(), { user: { phone: "******3210" } });
});

test("codes and phone numbers are never stored in the clear", async () => {
  await login("9123456789");
  const otp = await db.collection("otp_codes").find({}).toArray();
  const sessions = await db.collection("auth_sessions").find({}).toArray();
  const dump = JSON.stringify([...otp, ...sessions]);
  assert.ok(!dump.includes("9123456789"), "phone number stored in plain text");
});

test("a wrong code is rejected, and attempts lock after five tries", async () => {
  const phone = "9000000001";
  const { devCode } = await (await fetch(`${base}/auth/otp/request`, json("POST", { phone }))).json();
  const wrong = devCode === "000000" ? "111111" : "000000";
  for (let i = 0; i < 4; i++) assert.equal((await fetch(`${base}/auth/otp/verify`, json("POST", { phone, code: wrong }))).status, 401);
  const fifth = await (await fetch(`${base}/auth/otp/verify`, json("POST", { phone, code: wrong }))).json();
  assert.match(fifth.error, /Too many attempts/);
  const right = await fetch(`${base}/auth/otp/verify`, json("POST", { phone, code: devCode }));
  assert.equal(right.status, 401, "locked even with the right code");
});

test("a code works once", async () => {
  const phone = "9000000002";
  const { devCode } = await (await fetch(`${base}/auth/otp/request`, json("POST", { phone }))).json();
  assert.equal((await fetch(`${base}/auth/otp/verify`, json("POST", { phone, code: devCode }))).status, 200);
  assert.equal((await fetch(`${base}/auth/otp/verify`, json("POST", { phone, code: devCode }))).status, 401);
});

test("patients see and cancel only their own appointments", async () => {
  const date = addDays(clinicToday(), 3);
  const book = (patientPhone, time) => fetch(`${base}/appointments`, json("POST", { doctorId, patientName: "Test Patient", patientPhone, date, time }));
  assert.equal((await book("9811111111", "10:00")).status, 201);
  const other = await (await book("9822222222", "10:30")).json();

  const cookie = await login("9811111111");
  const mine = await (await fetch(`${base}/me/appointments`, { headers: { cookie } })).json();
  assert.equal(mine.appointments.length, 1);
  assert.equal(mine.appointments[0].time, "10:00");
  assert.ok(!("patientPhone" in mine.appointments[0]));

  const steal = await fetch(`${base}/me/appointments/${other.appointment._id}/cancel`, { method: "PATCH", headers: { cookie } });
  assert.equal(steal.status, 404);
  const own = await fetch(`${base}/me/appointments/${mine.appointments[0]._id}/cancel`, { method: "PATCH", headers: { cookie } });
  assert.equal(own.status, 200);
});

test("signing out revokes the session", async () => {
  const cookie = await login("9833333333");
  await fetch(`${base}/auth/logout`, { method: "POST", headers: { cookie } });
  assert.equal((await fetch(`${base}/auth/me`, { headers: { cookie } })).status, 401);
});

test("no session cookie means 401", async () => {
  assert.equal((await fetch(`${base}/me/appointments`)).status, 401);
});

async function chat(sessionId, message) {
  const raw = await (await fetch(`${base}/chat`, json("POST", { sessionId, message }))).text();
  return raw.split("\n\n").map((e) => e.replace(/^data: /, "").trim()).filter((e) => e && e !== "[DONE]").map((e) => JSON.parse(e));
}

test("website chat sends booking requests to the booking form instead of collecting details", async () => {
  const { sessionId } = await (await fetch(`${base}/session`, json("POST", { channel: "website" }))).json();
  const [evt] = await chat(sessionId, "I want to book an appointment");
  assert.equal(evt.action, "book");
  assert.match(evt.text, /booking form/);
});

test("website chat sends record requests to the patient portal", async () => {
  const { sessionId } = await (await fetch(`${base}/session`, json("POST", { channel: "website" }))).json();
  const [evt] = await chat(sessionId, "show my discharge summary");
  assert.equal(evt.action, "portal");
});

test("crisis detection still comes first on the website channel", async () => {
  const { sessionId } = await (await fetch(`${base}/session`, json("POST", { channel: "website" }))).json();
  const [evt] = await chat(sessionId, "I want to kill myself");
  assert.equal(evt.crisis, true);
});

test("booking with an e-mailed code: wrong code refused, right code books, signs in and lists it", async () => {
  const email = "Priya.Sharma@Example.com";
  const date = addDays(clinicToday(), 2);
  const { slots } = await (await fetch(`${base}/appointments/slots?doctorId=${doctorId}&date=${date}`)).json();
  assert.ok(slots.length > 0, "the doctor has an open slot");
  const book = (code, time = slots[0]) => fetch(`${base}/appointments`, json("POST", { doctorId, patientName: "Priya Sharma", patientEmail: email, code, date, time }));

  assert.equal((await book(undefined)).status, 400); // no code
  const { devCode } = await (await fetch(`${base}/auth/otp/request`, json("POST", { email }))).json();
  assert.match(devCode, /^\d{6}$/);
  assert.equal((await book(devCode === "000000" ? "111111" : "000000")).status, 401); // wrong code
  const ok = await book(devCode);
  assert.equal(ok.status, 201);
  const cookie = cookieOf(ok);
  assert.match(cookie, /^thc_session=/);

  const mine = await (await fetch(`${base}/me/appointments`, { headers: { cookie } })).json();
  assert.equal(mine.appointments.length, 1);
  const me = await (await fetch(`${base}/auth/me`, { headers: { cookie } })).json();
  assert.match(me.user.email, /@example\.com$/);
  assert.ok(!JSON.stringify(me).includes("Priya"), "the e-mail is masked");
  assert.equal((await book(devCode, slots[1])).status, 401); // a code works once
});

test("an invalid e-mail address is rejected", async () => {
  const res = await fetch(`${base}/auth/otp/request`, json("POST", { email: "not-an-email" }));
  assert.equal(res.status, 400);
});
