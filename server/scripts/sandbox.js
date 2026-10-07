// `npm run dev:sandbox` — the real API server, but wired to an in-memory
// database (seeded with the doctor directory) and a stub of the hospital
// HMS. Use it to try booking and patient-record flows locally without:
//   - writing test appointments into the shared Atlas database, which the
//     deployed app also uses (so they'd show up as taken slots for real
//     patients), or
//   - calling the hospital's real HMS, whose patientdata API *creates* a
//     patient record whenever a lookup doesn't match.
// The LLM still uses GROQ_API_KEY from server/.env if it's set.
import "dotenv/config";
import http from "node:http";
import { createFakeDb } from "./fakeDb.js";

const HMS_STUB_PORT = Number(process.env.HMS_STUB_PORT) || 8799;

// Show e-mailed booking codes in the chat, so bookings can be tried without a
// real inbox. (Never applies in production: bookingFlow.js checks NODE_ENV.)
process.env.OTP_DEV_ECHO ??= "true";

// The one patient the stub HMS "knows". Any other details behave like the
// real API does on a miss: a brand-new patient is "registered".
const DEMO_PATIENT = { first: "ASHA", phone: "9999999999", uhid: "SANDBOX-UHID-1", patient_id: "254" };

const HMS_RESPONSES = {
  admissionStatusPush: {
    status: "ok",
    message: "Patient admission data found",
    data: {
      uhid: DEMO_PATIENT.uhid,
      care_team: "Dr. Example",
      admitting_complaint: "Anxiety, poor sleep",
      ward: "General Ward",
      admission_status: "Admitted",
      visit_date: "2026-09-23 10:30:00",
    },
  },
  dischargeSummaryPush: {
    status: "ok",
    message: "Discharge summary found",
    data: {
      uhid: DEMO_PATIENT.uhid,
      admission_date: "2026-09-20 10:30:00",
      discharge_date: "2026-09-23 15:30:00",
      admission_status: "Discharged",
      diagnosis: "Generalized anxiety",
      discharge_summary: "Treated and discharged in stable condition. Follow up in two weeks.",
    },
  },
  patientProfileVisitSync: {
    status: "ok",
    message: "Patient profile and visit history found",
    data: {
      uhid: DEMO_PATIENT.uhid,
      last_5_visit_dates: [
        { visit_date: "2026-09-14", visit_time: "15:33:52", token_number: "4", visit_type: "OPD", specialist_name: "RATNARAKSHIT INGOLE" },
        { visit_date: "2026-08-30", visit_time: "16:22:19", token_number: "1", visit_type: "OPD", specialist_name: "RATNARAKSHIT INGOLE" },
      ],
    },
  },
  prescriptionSync: {
    status: "ok",
    message: "Prescription data found",
    data: {
      uhid: DEMO_PATIENT.uhid,
      prescriptions: [
        { visit_date: "2026-09-14", complaints: "Poor sleep", diagnosis: "Insomnia", advice: "Sleep hygiene, follow up in 2 weeks", treatment: "As prescribed" },
      ],
    },
  },
};

function readJson(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        resolve({});
      }
    });
  });
}

const hmsStub = http.createServer(async (req, res) => {
  const endpoint = req.url.split("/").pop();
  const body = await readJson(req);
  let payload;
  if (endpoint === "patientdata") {
    const known = String(body.name).toUpperCase() === DEMO_PATIENT.first && body.phone === DEMO_PATIENT.phone;
    payload = known
      ? { status: "ok", statusCode: "yes", message: "Existing patient found", data: { uhid: DEMO_PATIENT.uhid, patient_id: DEMO_PATIENT.patient_id } }
      : { status: "ok", statusCode: "yes", message: "New patient registered", data: { uhid: "SANDBOX-NEW-PATIENT", patient_id: "9999" } };
  } else {
    payload = HMS_RESPONSES[endpoint] || { status: "error", message: "Unknown endpoint" };
  }
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
});

await new Promise((resolve) => hmsStub.listen(HMS_STUB_PORT, resolve));
process.env.HMS_API_BASE = `http://localhost:${HMS_STUB_PORT}/hms/api`;

// Imported only now: the fake database has to be in place before index.js
// runs, or it would connect to the real one.
const { setDb } = await import("../lib/db.js");
await setDb(createFakeDb());
const { importDoctors } = await import("./importDoctors.js");
const { total } = await importDoctors();

await import("../index.js");

console.log(`
[sandbox] In-memory database seeded with ${total} doctors; HMS stubbed on port ${HMS_STUB_PORT}.
[sandbox] Nothing here touches Atlas or the real HMS, and it all resets on restart.
[sandbox] Demo patient for records lookups: name "Asha Verma", any age, phone ${DEMO_PATIENT.phone}.`);
