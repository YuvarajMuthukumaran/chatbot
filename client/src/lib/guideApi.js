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

export async function fetchMedicines() {
  return handleJson(await fetch(`${API_BASE}/api/medicines`));
}

export async function fetchMedicine(slug) {
  return handleJson(await fetch(`${API_BASE}/api/medicines/${encodeURIComponent(slug)}`));
}
