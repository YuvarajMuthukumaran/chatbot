// Shared data-access layer for the doctor-search/appointment-booking
// feature — used by both the REST API (routes/doctors.js,
// routes/appointments.js) and the chatbot booking flow (bookingFlow.js),
// so the two surfaces can never drift out of sync on what "available" or
// "booked" means.
import { ObjectId } from "mongodb";
import { getDb } from "./db.js";
import { availableSlots } from "./slots.js";
import { clinicToday } from "./clinicTime.js";

const MAX_SEARCH_LENGTH = 80;

/** Escapes regex metacharacters so user input is matched literally. Raw input
 * used to go straight into $regex: a search for "(" was an invalid pattern
 * that crashed the server, and a name like "Dr. (Col.) Pavan Kumar Pardal"
 * couldn't even match itself. */
export function escapeRegex(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Anchored to the start of a word, so "anu" finds "Dr. Anu Yadav" without
// also matching the middle of some unrelated name.
export function nameSearchPattern(text) {
  const trimmed = String(text).trim().slice(0, MAX_SEARCH_LENGTH);
  const escaped = escapeRegex(trimmed);
  return /^\w/.test(trimmed) ? `\\b${escaped}` : escaped;
}

function containsPattern(text) {
  return escapeRegex(String(text).trim().slice(0, MAX_SEARCH_LENGTH));
}

/** `specialties` (an array) matches doctors tagged with any of them. */
export async function searchDoctors({ search, specialty, specialties, role, location } = {}) {
  const db = getDb();
  if (!db) return null;
  const query = {};
  if (search) query.name = { $regex: nameSearchPattern(search), $options: "i" };
  if (specialty) query.specialties = String(specialty);
  else if (specialties?.length) query.specialties = { $in: specialties.map(String) };
  if (role) query.role = { $regex: containsPattern(role), $options: "i" };
  if (location) query.location = { $regex: containsPattern(location), $options: "i" };
  return db.collection("doctors").find(query).sort({ name: 1 }).toArray();
}

export async function listSpecialties() {
  const db = getDb();
  if (!db) return null;
  const specialties = await db.collection("doctors").distinct("specialties");
  return specialties.filter(Boolean).sort();
}

export async function getDoctorById(id) {
  const db = getDb();
  if (!db) return null;
  try {
    return await db.collection("doctors").findOne({ _id: new ObjectId(String(id)) });
  } catch {
    return null;
  }
}

/** Open slots for a doctor on a date; for today (at the clinic), slots that
 * have already passed are excluded too. */
export async function getAvailableSlots(doctorId, date) {
  const db = getDb();
  if (!db) return null;
  const rows = await db
    .collection("appointments")
    .find({ doctorId: String(doctorId), date: String(date), status: "booked" })
    .project({ time: 1 })
    .toArray();
  return availableSlots(rows.map((r) => r.time), { date });
}

export async function bookAppointment({ doctorId, doctorName, patientName, patientPhone, date, time }) {
  const db = getDb();
  if (!db) throw new Error("Database not connected");

  await db
    .collection("patients")
    .updateOne(
      { phone: patientPhone },
      { $set: { name: patientName, phone: patientPhone, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
      { upsert: true }
    );

  const appointment = { doctorId, doctorName, patientName, patientPhone, date, time, status: "booked", createdAt: new Date() };
  const result = await db.collection("appointments").insertOne(appointment);
  return { ...appointment, _id: result.insertedId };
}

/** @param {{includeCancelled?: boolean, upcomingOnly?: boolean}} [options] -
 *   `upcomingOnly` drops appointments dated before today (at the clinic). */
export async function listAppointmentsByPhone(phone, { includeCancelled = false, upcomingOnly = false } = {}) {
  const db = getDb();
  if (!db) return null;
  const query = { patientPhone: String(phone) };
  if (!includeCancelled) query.status = "booked";
  if (upcomingOnly) query.date = { $gte: clinicToday() };
  return db.collection("appointments").find(query).sort({ date: 1, time: 1 }).toArray();
}

export async function cancelAppointment(id) {
  const db = getDb();
  if (!db) throw new Error("Database not connected");
  const result = await db
    .collection("appointments")
    .updateOne({ _id: new ObjectId(String(id)), status: "booked" }, { $set: { status: "cancelled", cancelledAt: new Date() } });
  return result.matchedCount > 0;
}

export async function getAppointmentById(id) {
  const db = getDb();
  if (!db) return null;
  try {
    return await db.collection("appointments").findOne({ _id: new ObjectId(String(id)) });
  } catch {
    return null;
  }
}

/** @throws {Error} with `.code === "SLOT_TAKEN"` if the new date/time is already booked */
export async function rescheduleAppointment(id, { date, time }) {
  const db = getDb();
  if (!db) throw new Error("Database not connected");
  try {
    const result = await db
      .collection("appointments")
      .updateOne({ _id: new ObjectId(String(id)), status: "booked" }, { $set: { date, time, rescheduledAt: new Date() } });
    return result.matchedCount > 0;
  } catch (err) {
    if (err?.code === 11000) {
      const slotTaken = new Error("That slot is already booked.");
      slotTaken.code = "SLOT_TAKEN";
      throw slotTaken;
    }
    throw err;
  }
}
