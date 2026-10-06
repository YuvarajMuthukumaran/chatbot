import { Router } from "express";
import { MEDICINES, MEDICINE_CATEGORIES, REVIEWED_BY, REVIEWED_ON, getMedicine, medicineSummary } from "../lib/medicines.js";

const router = Router();

// Fixed content: cacheable for an hour by browsers and CDNs.
const CACHE = "public, max-age=3600";

router.get("/medicines", (req, res) => {
  res.set("Cache-Control", CACHE);
  res.json({
    categories: MEDICINE_CATEGORIES,
    medicines: MEDICINES.map(medicineSummary),
    reviewedBy: REVIEWED_BY,
    reviewedOn: REVIEWED_ON,
  });
});

router.get("/medicines/:slug", (req, res) => {
  const medicine = getMedicine(req.params.slug);
  if (!medicine) return res.status(404).json({ error: "We don't have a guide for that medicine yet." });
  res.set("Cache-Control", CACHE);
  res.json({
    medicine,
    category: MEDICINE_CATEGORIES.find((c) => c.id === medicine.category) || null,
    reviewedBy: REVIEWED_BY,
    reviewedOn: REVIEWED_ON,
  });
});

export default router;
