import { Router } from "express";
import { getDb } from "../lib/db.js";
import { searchDoctors, listSpecialties, getDoctorById } from "../lib/bookingData.js";
import { importDoctors } from "../scripts/importDoctors.js";

const router = Router();

function dbOrError(res) {
  if (!getDb()) {
    res.status(503).json({ error: "Database not connected. Try again shortly." });
    return false;
  }
  return true;
}

// GET /api/doctors?search=&specialty=&role=&location=
router.get("/doctors", async (req, res) => {
  if (!dbOrError(res)) return;
  const { search, specialty, role, location } = req.query;
  const doctors = await searchDoctors({ search, specialty, role, location });
  res.json({ count: doctors.length, doctors });
});

// GET /api/doctors/specialties — distinct specialty tags, for a filter dropdown
router.get("/doctors/specialties", async (req, res) => {
  if (!dbOrError(res)) return;
  res.json({ specialties: await listSpecialties() });
});

// POST /api/doctors/import — (re)load the scraped doctor directory into the DB
router.post("/doctors/import", async (req, res) => {
  try {
    const summary = await importDoctors();
    res.json({ ok: true, ...summary });
  } catch (err) {
    res.status(500).json({ error: err?.message || "Import failed" });
  }
});

// GET /api/doctors/:id
router.get("/doctors/:id", async (req, res) => {
  if (!dbOrError(res)) return;
  const doctor = await getDoctorById(req.params.id);
  if (!doctor) return res.status(404).json({ error: "Doctor not found" });
  res.json({ doctor });
});

export default router;
