import { timingSafeEqual } from "node:crypto";

// Admin-only endpoints (currently just the doctor import) need the
// X-Admin-Token header to match ADMIN_TOKEN. With ADMIN_TOKEN unset they're
// switched off entirely — previously anyone on the internet could trigger
// them.
export function requireAdmin(req, res, next) {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) {
    return res.status(403).json({ error: "Admin endpoints are disabled (ADMIN_TOKEN is not set)." });
  }
  const given = Buffer.from(String(req.get("x-admin-token") || ""));
  const wanted = Buffer.from(expected);
  if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}
