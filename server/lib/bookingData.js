// Shared data-access layer for the doctor-search/appointment-booking
// feature — used by both the REST API (routes/doctors.js,
// routes/appointments.js) and the chatbot booking flow (bookingFlow.js),
// so the two surfaces can never drift out of sync on what "available" or
// "booked" means.
import { ObjectId } from "mongodb";
import { getDb } from "./db.js";
import { availableSlots } from "./slots.js";

export async function searchDoctors({ search, specialty, role, location } = {}) {
  const db = getDb();
  if (!db) return null;
  const query = {};
  if (search) query.name = { $regex: String(search), $options: "i" };
  if (specialty) query.specialties = specialty;
  if (role) query.role = { $regex: String(role), $options: "i" };
  if (location) query.location = { $regex: String(location), $options: "i" };
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
    return await db.collection("doctors").findOne({ _id: new ObjectId(id) });
  } catch {
    return null;
  }
}

export async function getAvailableSlots(doctorId, date) {
  const db = getDb();
  if (!db) return null;
  const rows = await db
    .collection("appointments")
    .find({ doctorId, date, status: "booked" })
    .project({ time: 1 })
    .toArray();
  return availableSlots(rows.map((r) => r.time));
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

export async function listAppointmentsByPhone(phone, { includeCancelled = false } = {}) {
  const db = getDb();
  if (!db) return null;
  const query = { patientPhone: phone };
  if (!includeCancelled) query.status = "booked";
  return db.collection("appointments").find(query).sort({ date: 1, time: 1 }).toArray();
}

export async function cancelAppointment(id) {
  const db = getDb();
  if (!db) throw new Error("Database not connected");
  const result = await db
    .collection("appointments")
    .updateOne({ _id: new ObjectId(id), status: "booked" }, { $set: { status: "cancelled", cancelledAt: new Date() } });
  return result.matchedCount > 0;
}

/** @throws {Error} with `.code === "SLOT_TAKEN"` if the new date/time is already booked */
export async function rescheduleAppointment(id, { date, time }) {
  const db = getDb();
  if (!db) throw new Error("Database not connected");
  try {
    const result = await db
      .collection("appointments")
      .updateOne({ _id: new ObjectId(id), status: "booked" }, { $set: { date, time, rescheduledAt: new Date() } });
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
