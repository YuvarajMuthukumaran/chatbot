// Patient login (phone + one-time code) and the signed-in patient's own
// appointments. The session lives in an httpOnly, Secure, SameSite=Lax
// cookie scoped to the parent domain (COOKIE_DOMAIN=.tulasihealthcare.com),
// so www. and api. share it while page scripts can never read it.
import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler.js";
import { createRateLimiter, limitByIp, TOO_MANY_REQUESTS } from "../lib/rateLimit.js";
import { normalizeEmail, normalizePhone } from "../lib/patientDetails.js";
import { issueOtp, verifyOtp, createAuthSession, readAuthSession, revokeAuthSession, SESSION_TTL_MS } from "../lib/authStore.js";
import { sendLoginCode, sendLoginCodeEmail } from "../lib/notify.js";
import { lookupHash, maskEmail, maskPhone } from "../lib/secure.js";
import { getAppointmentById, listAppointmentsByEmail, listAppointmentsByPhone, cancelAppointment } from "../lib/bookingData.js";

const router = Router();
const MINUTE = 60_000;
const COOKIE = "thc_session";
const isProd = process.env.NODE_ENV === "production";

// Per IP and per phone number, so neither a single client nor a distributed
// one can flood a number with codes or guess codes.
const otpPerIp = createRateLimiter({ windowMs: 10 * MINUTE, max: 10 });
const otpPerPhone = createRateLimiter({ windowMs: 10 * MINUTE, max: 3 });
const verifyPerIp = createRateLimiter({ windowMs: 10 * MINUTE, max: 20 });

/** A visitor is identified by an e-mail address (stored as "email:<address>") or, for older sign-ins, a mobile number. */
export const identityFrom = (body) => {
  const email = body?.email ? normalizeEmail(body.email) : null;
  if (email) return { id: `email:${email}`, email };
  const phone = body?.phone ? normalizePhone(String(body.phone)) : null;
  return phone ? { id: phone, phone } : null;
};
export const isEmailId = (id) => String(id).startsWith("email:");
const describe = (id) => (isEmailId(id) ? { email: maskEmail(String(id).slice(6)) } : { phone: maskPhone(id) });

export function cookieHeader(value, maxAgeMs) {
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

// POST /api/auth/otp/request  { email }  (a { phone } is still accepted)
router.post(
  "/auth/otp/request",
  limitByIp(otpPerIp),
  asyncHandler(async (req, res) => {
    const who = identityFrom(req.body);
    if (!who) return res.status(400).json({ error: req.body?.phone && !req.body?.email ? "Please enter a valid 10-digit mobile number." : "Please enter a valid e-mail address." });
    if (!otpPerPhone.consume(lookupHash(who.id)).ok) return res.status(429).json({ error: TOO_MANY_REQUESTS });
    const code = await issueOtp(who.id);
    try {
      if (who.email) await sendLoginCodeEmail(who.email, code);
      else await sendLoginCode(who.phone, code);
    } catch (err) {
      console.error("Sending the verification code failed:", err?.message);
      return res.status(502).json({ error: "We couldn't send the code just now. Please try again in a moment." });
    }
    // OTP_DEV_ECHO lets the sandbox/demo show the code on screen. Never in production.
    res.json({ ok: true, ...(process.env.OTP_DEV_ECHO === "true" && !isProd ? { devCode: code } : {}) });
  })
);

// POST /api/auth/otp/verify  { email, code }
router.post(
  "/auth/otp/verify",
  limitByIp(verifyPerIp),
  asyncHandler(async (req, res) => {
    const who = identityFrom(req.body);
    const code = String(req.body?.code ?? "").replace(/\D/g, "");
    if (!who || code.length !== 6) return res.status(400).json({ error: "Enter the 6-digit code we sent you." });
    const result = await verifyOtp(who.id, code);
    if (result !== "ok") {
      const msg = { expired: "That code has expired. Please request a new one.", locked: "Too many attempts. Please request a new code.", invalid: "That code isn't right. Please check and try again." }[result];
      return res.status(401).json({ error: msg });
    }
    const token = await createAuthSession(who.id);
    res.setHeader("Set-Cookie", cookieHeader(encodeURIComponent(token), SESSION_TTL_MS));
    res.json({ ok: true, user: describe(who.id) });
  })
);

// GET /api/auth/me
router.get(
  "/auth/me",
  requirePatient,
  (req, res) => res.json({ user: describe(req.patient.phone) })
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
    const id = req.patient.phone;
    const list = (isEmailId(id) ? await listAppointmentsByEmail(String(id).slice(6), { includeCancelled: true }) : await listAppointmentsByPhone(id, { includeCancelled: true })) ?? [];
    res.json({ appointments: list.map(publicView) });
  })
);

// PATCH /api/me/appointments/:id/cancel: ownership is checked server-side.
router.patch(
  "/me/appointments/:id/cancel",
  requirePatient,
  asyncHandler(async (req, res) => {
    const appt = await getAppointmentById(req.params.id).catch(() => null);
    const id = req.patient.phone;
    const mine = appt && (isEmailId(id) ? appt.patientEmail === String(id).slice(6) : appt.patientPhone === id);
    if (!mine) return res.status(404).json({ error: "Appointment not found." });
    if (appt.status !== "booked") return res.status(409).json({ error: "This appointment is no longer active." });
    await cancelAppointment(req.params.id);
    res.json({ ok: true });
  })
);

export default router;
