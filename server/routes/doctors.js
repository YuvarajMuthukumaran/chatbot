import { Router } from "express";
import { getDb } from "../lib/db.js";
import { searchDoctors, listSpecialties, getDoctorById } from "../lib/bookingData.js";
import { importDoctors } from "../scripts/importDoctors.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { requireAdmin } from "../lib/adminAuth.js";

const router = Router();

function dbOrError(res) {
  if (!getDb()) {
    res.status(503).json({ error: "Database not connected. Try again shortly." });
    return false;
  }
  return true;
}

// Query-string values can arrive as arrays or objects (?search[$ne]=x);
// only plain strings are ever passed on to the database layer.
const str = (value) => (typeof value === "string" ? value : undefined);

// GET /api/doctors?search=&specialty=&role=&location=
router.get(
  "/doctors",
  asyncHandler(async (req, res) => {
    if (!dbOrError(res)) return;
    const { search, specialty, role, location } = req.query;
    const doctors = await searchDoctors({ search: str(search), specialty: str(specialty), role: str(role), location: str(location) });
    res.json({ count: doctors.length, doctors });
  })
);

// GET /api/doctors/specialties — distinct specialty tags, for a filter dropdown
router.get(
  "/doctors/specialties",
  asyncHandler(async (req, res) => {
    if (!dbOrError(res)) return;
    res.json({ specialties: await listSpecialties() });
  })
);

// POST /api/doctors/import — (re)load the doctor directory into the DB.
// Requires the X-Admin-Token header (see lib/adminAuth.js); locally,
// `npm run import-doctors` does the same without going through HTTP.
router.post(
  "/doctors/import",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const summary = await importDoctors();
    res.json({ ok: true, ...summary });
  })
);

// GET /api/doctors/:id
router.get(
  "/doctors/:id",
  asyncHandler(async (req, res) => {
    if (!dbOrError(res)) return;
    const doctor = await getDoctorById(req.params.id);
    if (!doctor) return res.status(404).json({ error: "Doctor not found" });
    res.json({ doctor });
  })
);

export default router;
