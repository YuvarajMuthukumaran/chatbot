// Patient login (phone + one-time code) and the signed-in patient's own
// appointments. The session lives in an httpOnly, Secure, SameSite=Lax
// cookie scoped to the parent domain (COOKIE_DOMAIN=.tulasihealthcare.com),
// so www. and api. share it while page scripts can never read it.
import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler.js";
import { createRateLimiter, limitByIp, TOO_MANY_REQUESTS } from "../lib/rateLimit.js";
import { normalizePhone } from "../lib/patientDetails.js";
import { issueOtp, verifyOtp, createAuthSession, readAuthSession, revokeAuthSession, SESSION_TTL_MS } from "../lib/authStore.js";
import { sendLoginCode } from "../lib/notify.js";
import { lookupHash, maskPhone } from "../lib/secure.js";
import { getAppointmentById, listAppointmentsByPhone, cancelAppointment } from "../lib/bookingData.js";

const router = Router();
const MINUTE = 60_000;
const COOKIE = "thc_session";
const isProd = process.env.NODE_ENV === "production";

// Per IP and per phone number, so neither a single client nor a distributed
// one can flood a number with codes or guess codes.
const otpPerIp = createRateLimiter({ windowMs: 10 * MINUTE, max: 10 });
const otpPerPhone = createRateLimiter({ windowMs: 10 * MINUTE, max: 3 });
const verifyPerIp = createRateLimiter({ windowMs: 10 * MINUTE, max: 20 });

function cookieHeader(value, maxAgeMs) {
  const parts = [`${COOKIE}=${value}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${Math.floor(maxAgeMs / 1000)}`];
  if (process.env.COOKIE_SECURE !== "false" && (isProd || process.env.COOKIE_SECURE === "true")) parts.push("Secure");
  if (process.env.COOKIE_DOMAIN) parts.push(`Domain=${process.env.COOKIE_DOMAIN}`);
  return parts.join("; ");
}

function tokenFrom(req) {
  const raw = req.headers.cookie ?? "";
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === COOKIE) return decodeURIComponent(v.join("="));
  }
  return null;
}

/** Middleware: attaches req.patient = { phone } or answers 401. */
export const requirePatient = asyncHandler(async (req, res, next) => {
  const session = await readAuthSession(tokenFrom(req));
  if (!session) return res.status(401).json({ error: "Please sign in again." });
  req.patient = session;
  next();
});

// POST /api/auth/otp/request  { phone }
router.post(
  "/auth/otp/request",
  limitByIp(otpPerIp),
  asyncHandler(async (req, res) => {
    const phone = normalizePhone(String(req.body?.phone ?? ""));
    if (!phone) return res.status(400).json({ error: "Please enter a valid 10-digit mobile number." });
    if (!otpPerPhone.consume(lookupHash(phone)).ok) return res.status(429).json({ error: TOO_MANY_REQUESTS });
    const code = await issueOtp(phone);
    await sendLoginCode(phone, code);
    // OTP_DEV_ECHO lets the sandbox/demo show the code on screen. Never in production.
    res.json({ ok: true, ...(process.env.OTP_DEV_ECHO === "true" && !isProd ? { devCode: code } : {}) });
  })
);

// POST /api/auth/otp/verify  { phone, code }
router.post(
  "/auth/otp/verify",
  limitByIp(verifyPerIp),
  asyncHandler(async (req, res) => {
    const phone = normalizePhone(String(req.body?.phone ?? ""));
    const code = String(req.body?.code ?? "").replace(/\D/g, "");
    if (!phone || code.length !== 6) return res.status(400).json({ error: "Enter the 6-digit code we sent you." });
    const result = await verifyOtp(phone, code);
    if (result !== "ok") {
      const msg = { expired: "That code has expired. Please request a new one.", locked: "Too many attempts. Please request a new code.", invalid: "That code isn't right. Please check and try again." }[result];
      return res.status(401).json({ error: msg });
    }
    const token = await createAuthSession(phone);
    res.setHeader("Set-Cookie", cookieHeader(encodeURIComponent(token), SESSION_TTL_MS));
    res.json({ ok: true, user: { phone: maskPhone(phone) } });
  })
);

// GET /api/auth/me
router.get(
  "/auth/me",
  requirePatient,
  (req, res) => res.json({ user: { phone: maskPhone(req.patient.phone) } })
);

// POST /api/auth/logout
router.post(
  "/auth/logout",
  asyncHandler(async (req, res) => {
    await revokeAuthSession(tokenFrom(req));
    res.setHeader("Set-Cookie", cookieHeader("", 0));
    res.json({ ok: true });
  })
);

const publicView = ({ _id, doctorId, doctorName, date, time, status }) => ({ _id, doctorId, doctorName, date, time, status });

// GET /api/me/appointments: only the signed-in patient's own appointments.
router.get(
  "/me/appointments",
  requirePatient,
  asyncHandler(async (req, res) => {
    const list = (await listAppointmentsByPhone(req.patient.phone, { includeCancelled: true })) ?? [];
    res.json({ appointments: list.map(publicView) });
  })
);

// PATCH /api/me/appointments/:id/cancel: ownership is checked server-side.
router.patch(
  "/me/appointments/:id/cancel",
  requirePatient,
  asyncHandler(async (req, res) => {
    const appt = await getAppointmentById(req.params.id).catch(() => null);
    if (!appt || appt.patientPhone !== req.patient.phone) return res.status(404).json({ error: "Appointment not found." });
    if (appt.status !== "booked") return res.status(409).json({ error: "This appointment is no longer active." });
    await cancelAppointment(req.params.id);
    res.json({ ok: true });
  })
);

export default router;
