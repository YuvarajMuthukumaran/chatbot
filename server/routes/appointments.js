import { Router } from "express";
import { getDb } from "../lib/db.js";
import { checkBookableDate, BOOKING_WINDOW_DAYS } from "../lib/slots.js";
import { normalizePhone, cleanPersonName } from "../lib/patientDetails.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { limiters, limitByIp } from "../lib/rateLimit.js";
import {
  getDoctorById,
  getAvailableSlots,
  getAppointmentById,
  bookAppointment,
  listAppointmentsByPhone,
  cancelAppointment,
  rescheduleAppointment,
} from "../lib/bookingData.js";

const router = Router();

function dbOrError(res) {
  if (!getDb()) {
    res.status(503).json({ error: "Database not connected. Try again shortly." });
    return false;
  }
  return true;
}

const DATE_ERRORS = {
  invalid: "date must be a real date in YYYY-MM-DD format",
  past: "That date has already passed — please pick an upcoming one.",
  too_far: `Appointments can be booked up to ${BOOKING_WINDOW_DAYS} days ahead.`,
};

/** Responds with an error and returns false unless `time` is genuinely open
 * for this doctor on `date` — which also rules out past dates, same-day
 * times that have already gone by, and slots someone else holds. */
async function ensureSlotOpen(res, doctorId, date, time) {
  const dateCheck = checkBookableDate(date);
  if (dateCheck !== "ok") {
    res.status(400).json({ error: DATE_ERRORS[dateCheck] });
    return false;
  }
  const open = await getAvailableSlots(doctorId, date);
  if (!open?.includes(time)) {
    res.status(409).json({ error: "That time isn't available. Please pick another." });
    return false;
  }
  return true;
}

// Only what the appointments page shows — not the stored phone number,
// patient name, or bookkeeping fields.
const publicView = ({ _id, doctorId, doctorName, date, time, status }) => ({ _id, doctorId, doctorName, date, time, status });

// GET /api/appointments/slots?doctorId=&date=
router.get(
  "/appointments/slots",
  asyncHandler(async (req, res) => {
    if (!dbOrError(res)) return;
    const { doctorId, date } = req.query;
    if (typeof doctorId !== "string" || !doctorId || checkBookableDate(date) === "invalid") {
      return res.status(400).json({ error: "doctorId and a valid date (YYYY-MM-DD) are required" });
    }
    const slots = checkBookableDate(date) === "ok" ? await getAvailableSlots(doctorId, date) : [];
    res.json({ doctorId, date, slots });
  })
);

// POST /api/appointments — { doctorId, patientName, patientPhone, date, time }
// (doctorName is still accepted for older clients, but the stored name
// always comes from the doctor record itself.)
router.post(
  "/appointments",
  limitByIp(limiters.booking),
  asyncHandler(async (req, res) => {
    if (!dbOrError(res)) return;

    const { doctorId, patientName, patientPhone, date, time } = req.body || {};
    if (!doctorId || !patientName || !patientPhone || !date || !time) {
      return res.status(400).json({ error: "doctorId, patientName, patientPhone, date, and time are all required" });
    }
    const phone = normalizePhone(String(patientPhone));
    if (!phone) return res.status(400).json({ error: "patientPhone must be a 10-digit mobile number" });
    const name = cleanPersonName(String(patientName));
    if (!name) return res.status(400).json({ error: "Please enter the patient's full name." });

    const doctor = await getDoctorById(doctorId);
    if (!doctor) return res.status(404).json({ error: "Doctor not found" });
    if (!(await ensureSlotOpen(res, String(doctor._id), date, time))) return;

    try {
      const appointment = await bookAppointment({
        doctorId: String(doctor._id),
        doctorName: doctor.name,
        patientName: name,
        patientPhone: phone,
        date,
        time,
      });
      res.status(201).json({ ok: true, appointment: publicView(appointment) });
    } catch (err) {
      if (err?.code === 11000) {
        return res.status(409).json({ error: "That slot was just booked by someone else. Please pick another." });
      }
      throw err;
    }
  })
);

// GET /api/appointments?phone=
router.get(
  "/appointments",
  limitByIp(limiters.phoneLookup),
  asyncHandler(async (req, res) => {
    if (!dbOrError(res)) return;
    const phone = normalizePhone(typeof req.query.phone === "string" ? req.query.phone : "");
    if (!phone) {
      return res.status(400).json({ error: "A valid 10-digit mobile number is required" });
    }
    const appointments = await listAppointmentsByPhone(phone, { includeCancelled: true });
    res.json({ count: appointments.length, appointments: appointments.map(publicView) });
  })
);

// PATCH /api/appointments/:id/cancel
router.patch(
  "/appointments/:id/cancel",
  limitByIp(limiters.booking),
  asyncHandler(async (req, res) => {
    if (!dbOrError(res)) return;
    let ok;
    try {
      ok = await cancelAppointment(req.params.id);
    } catch {
      return res.status(400).json({ error: "Invalid appointment id" });
    }
    if (!ok) return res.status(404).json({ error: "No booked appointment found with that id" });
    res.json({ ok: true });
  })
);

// PATCH /api/appointments/:id — reschedule: { date, time }
router.patch(
  "/appointments/:id",
  limitByIp(limiters.booking),
  asyncHandler(async (req, res) => {
    if (!dbOrError(res)) return;
    const { date, time } = req.body || {};
    const appt = await getAppointmentById(req.params.id);
    if (!appt || appt.status !== "booked") {
      return res.status(404).json({ error: "No booked appointment found with that id" });
    }
    if (!(await ensureSlotOpen(res, appt.doctorId, date, time))) return;

    try {
      const ok = await rescheduleAppointment(req.params.id, { date, time });
      if (!ok) return res.status(404).json({ error: "No booked appointment found with that id" });
      res.json({ ok: true });
    } catch (err) {
      if (err?.code === "SLOT_TAKEN") {
        return res.status(409).json({ error: "That slot is already booked. Please pick another." });
      }
      throw err;
    }
  })
);

export default router;
