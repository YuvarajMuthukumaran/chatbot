import { Router } from "express";
import { getDb } from "../lib/db.js";
import { isValidDate, isValidSlotTime } from "../lib/slots.js";
import {
  getAvailableSlots,
  bookAppointment,
  listAppointmentsByPhone,
  cancelAppointment,
  rescheduleAppointment,
} from "../lib/bookingData.js";

const router = Router();
const PHONE_PATTERN = /^\d{10}$/;

function dbOrError(res) {
  if (!getDb()) {
    res.status(503).json({ error: "Database not connected. Try again shortly." });
    return false;
  }
  return true;
}

// GET /api/appointments/slots?doctorId=&date=
router.get("/appointments/slots", async (req, res) => {
  if (!dbOrError(res)) return;
  const { doctorId, date } = req.query;
  if (!doctorId || !isValidDate(date)) {
    return res.status(400).json({ error: "doctorId and a valid date (YYYY-MM-DD) are required" });
  }
  res.json({ doctorId, date, slots: await getAvailableSlots(doctorId, date) });
});

// POST /api/appointments — { doctorId, doctorName, patientName, patientPhone, date, time }
router.post("/appointments", async (req, res) => {
  if (!dbOrError(res)) return;

  const { doctorId, doctorName, patientName, patientPhone, date, time } = req.body || {};
  if (!doctorId || !doctorName || !patientName || !patientPhone || !date || !time) {
    return res.status(400).json({ error: "doctorId, doctorName, patientName, patientPhone, date, and time are all required" });
  }
  if (!PHONE_PATTERN.test(patientPhone)) {
    return res.status(400).json({ error: "patientPhone must be a 10-digit number" });
  }
  if (!isValidDate(date)) return res.status(400).json({ error: "date must be YYYY-MM-DD" });
  if (!isValidSlotTime(time)) {
    return res.status(400).json({ error: "time must be one of the bookable slot times (e.g. 09:00)" });
  }

  try {
    const appointment = await bookAppointment({ doctorId, doctorName, patientName, patientPhone, date, time });
    res.status(201).json({ ok: true, appointment });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ error: "That slot was just booked by someone else. Please pick another." });
    }
    console.error("Appointment booking failed:", err?.message || err);
    res.status(500).json({ error: "Could not book the appointment. Please try again." });
  }
});

// GET /api/appointments?phone=
router.get("/appointments", async (req, res) => {
  if (!dbOrError(res)) return;
  const { phone } = req.query;
  if (!phone || !PHONE_PATTERN.test(phone)) {
    return res.status(400).json({ error: "A valid 10-digit phone number is required" });
  }
  const appointments = await listAppointmentsByPhone(phone, { includeCancelled: true });
  res.json({ count: appointments.length, appointments });
});

// PATCH /api/appointments/:id/cancel
router.patch("/appointments/:id/cancel", async (req, res) => {
  if (!dbOrError(res)) return;
  let ok;
  try {
    ok = await cancelAppointment(req.params.id);
  } catch {
    return res.status(400).json({ error: "Invalid appointment id" });
  }
  if (!ok) return res.status(404).json({ error: "No booked appointment found with that id" });
  res.json({ ok: true });
});

// PATCH /api/appointments/:id — reschedule: { date, time }
router.patch("/appointments/:id", async (req, res) => {
  if (!dbOrError(res)) return;
  const { date, time } = req.body || {};
  if (!isValidDate(date)) return res.status(400).json({ error: "date must be YYYY-MM-DD" });
  if (!isValidSlotTime(time)) {
    return res.status(400).json({ error: "time must be one of the bookable slot times (e.g. 09:00)" });
  }

  try {
    const ok = await rescheduleAppointment(req.params.id, { date, time });
    if (!ok) return res.status(404).json({ error: "No booked appointment found with that id" });
    res.json({ ok: true });
  } catch (err) {
    if (err?.code === "SLOT_TAKEN") {
      return res.status(409).json({ error: "That slot is already booked. Please pick another." });
    }
    console.error("Reschedule failed:", err?.message || err);
    res.status(500).json({ error: "Could not reschedule the appointment. Please try again." });
  }
});

export default router;
