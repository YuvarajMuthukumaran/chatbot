import { Router } from "express";
import { createSession, setProfile, deleteSession } from "../lib/sessionStore.js";
import { getCrisisResources } from "../lib/crisisResources.js";

const router = Router();
const region = process.env.CRISIS_REGION || "IN";

router.post("/session", (req, res) => {
  const id = createSession();
  const { name, mood } = req.body || {};
  if (name || mood != null) {
    setProfile(id, { name, mood });
  }
  res.json({ sessionId: id, crisisResources: getCrisisResources(region) });
});

router.delete("/session/:id", (req, res) => {
  deleteSession(req.params.id);
  res.status(204).end();
});

export default router;
