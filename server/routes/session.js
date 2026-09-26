import { Router } from "express";
import { createSession, setProfile, deleteSession } from "../lib/sessionStore.js";
import { getCrisisResources } from "../lib/crisisResources.js";

const router = Router();
const region = process.env.CRISIS_REGION || "IN";

// Independent of session lifecycle so this safety-critical content is
// never stuck on a stale cached copy — a session created weeks ago
// shouldn't pin a user to hotline numbers current only when they first
// showed up.
router.get("/crisis-resources", (req, res) => {
  res.json(getCrisisResources(region));
});

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
