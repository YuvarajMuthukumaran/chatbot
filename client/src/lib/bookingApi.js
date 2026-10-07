import { API_BASE } from "./apiBase.js";

async function handleJson(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || "Something went wrong");
    err.status = res.status;
    throw err;
  }
  return data;
}

// The Doctors page only lists doctors: booking itself happens in the chat,
// where the patient's email is confirmed with an e-mailed code.

export async function fetchDoctors({ search, specialty, location } = {}) {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (specialty) params.set("specialty", specialty);
  if (location) params.set("location", location);
  const res = await fetch(`${API_BASE}/api/doctors?${params}`);
  return handleJson(res);
}

export async function fetchSpecialties() {
  const res = await fetch(`${API_BASE}/api/doctors/specialties`);
  return handleJson(res);
}
