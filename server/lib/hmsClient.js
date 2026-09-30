// Thin wrapper around Tulasi Health Care's HMS (Hospital Management System)
// API — see Tulsi_Health_Care_5_API_Documentation_Updated.docx for the
// original spec. No authentication scheme was documented for these
// endpoints; HMS_AUTH_HEADER/HMS_AUTH_VALUE are here so real auth can be
// dropped in via env vars once confirmed with the HMS/IT team, without a
// code change. Until then, requests go out with no extra auth header.
// Read per request, not at import, so tests and the sandbox can point this at
// a stub no matter when the module was first loaded — the real patientdata
// API creates a patient record on every lookup that doesn't match.
const hmsBase = () => process.env.HMS_API_BASE || "https://tulasihms.in/hms/api";
const HMS_AUTH_HEADER = process.env.HMS_AUTH_HEADER;
const HMS_AUTH_VALUE = process.env.HMS_AUTH_VALUE;
const HMS_TIMEOUT_MS = 10_000;

function buildHeaders() {
  const headers = { "Content-Type": "application/json" };
  if (HMS_AUTH_HEADER && HMS_AUTH_VALUE) headers[HMS_AUTH_HEADER] = HMS_AUTH_VALUE;
  return headers;
}

async function hmsPost(path, body) {
  const res = await fetch(`${hmsBase()}/${path}`, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(HMS_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`HMS API ${path} responded with HTTP ${res.status}`);
  }
  return res.json();
}

/** API-1: match an existing patient, or create one, by name + DOB + phone. */
export function matchOrRegisterPatient({ name, middle_name = "", l_name, dob, phone, address = "", branch_id = "1" }) {
  return hmsPost("patientdata", { name, middle_name, l_name, dob, phone, address, branch_id });
}

/** API-2: IPD admission info (doctor, ward, status, complaint, visit date) for a UHID. */
export function getAdmissionStatus(uhid) {
  return hmsPost("admissionStatusPush", { uhid });
}

/** API-3: discharge summary for a UHID. */
export function getDischargeSummary(uhid) {
  return hmsPost("dischargeSummaryPush", { uhid });
}

/** API-4: profile + last 5 visits + last 5 prescriptions for a UHID. */
export function getPatientProfile(uhid) {
  return hmsPost("patientProfileVisitSync", { uhid });
}

/** API-5: latest prescriptions for a UHID. */
export function getPrescriptions(uhid) {
  return hmsPost("prescriptionSync", { uhid });
}
