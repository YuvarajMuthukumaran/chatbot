const API_BASE = import.meta.env.VITE_API_URL || "";

async function handleJson(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong");
  return data;
}

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

export async function fetchDoctor(id) {
  const res = await fetch(`${API_BASE}/api/doctors/${id}`);
  return handleJson(res);
}

export async function fetchSlots(doctorId, date) {
  const params = new URLSearchParams({ doctorId, date });
  const res = await fetch(`${API_BASE}/api/appointments/slots?${params}`);
  return handleJson(res);
}

export async function createAppointment(payload) {
  const res = await fetch(`${API_BASE}/api/appointments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleJson(res);
}

export async function fetchMyAppointments(phone) {
  const params = new URLSearchParams({ phone });
  const res = await fetch(`${API_BASE}/api/appointments?${params}`);
  return handleJson(res);
}

export async function cancelAppointmentApi(id) {
  const res = await fetch(`${API_BASE}/api/appointments/${id}/cancel`, { method: "PATCH" });
  return handleJson(res);
}

export async function rescheduleAppointmentApi(id, { date, time }) {
  const res = await fetch(`${API_BASE}/api/appointments/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ date, time }),
  });
  return handleJson(res);
}
