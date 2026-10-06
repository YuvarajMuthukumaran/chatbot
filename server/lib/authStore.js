// Phone OTP login for the website's patient portal.
//
// Stored (MongoDB):
//   otp_codes      { phoneHash, codeHash, expiresAt, attempts, consumedAt }
//   auth_sessions  { tokenHash, phoneHash, phoneEnc, createdAt, expiresAt, revokedAt }
// Nothing here is stored in the clear: the phone number is a keyed hash (for
// lookup) plus AES-GCM ciphertext (to list that person's appointments); OTP
// codes and session tokens are stored only as SHA-256 hashes.
// Only $set updates are used, so the in-memory sandbox DB supports it too.
import crypto from "node:crypto";
import { getDb } from "./db.js";
import { decrypt, encrypt, lookupHash, safeEqualHex, sha256 } from "./secure.js";

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
export const SESSION_TTL_MS = Number(process.env.AUTH_SESSION_DAYS || 7) * 24 * 60 * 60 * 1000;

const db = () => {
  const d = getDb();
  if (!d) throw Object.assign(new Error("Database not connected"), { status: 503 });
  return d;
};

/** Creates a fresh code for this phone (any earlier unused code stops working). */
export async function issueOtp(phone) {
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  const phoneHash = lookupHash(phone);
  const now = new Date();
  await db().collection("otp_codes").updateOne(
    { phoneHash },
    { $set: { phoneHash, codeHash: sha256(`${phoneHash}:${code}`), expiresAt: new Date(now.getTime() + OTP_TTL_MS), attempts: 0, consumedAt: null, createdAt: now } },
    { upsert: true }
  );
  return code;
}

/** @returns {"ok" | "invalid" | "expired" | "locked"} */
export async function verifyOtp(phone, code) {
  const phoneHash = lookupHash(phone);
  const col = db().collection("otp_codes");
  const row = await col.findOne({ phoneHash });
  if (!row || row.consumedAt) return "invalid";
  if (row.expiresAt < new Date()) return "expired";
  if (row.attempts >= OTP_MAX_ATTEMPTS) return "locked";
  const ok = safeEqualHex(row.codeHash, sha256(`${phoneHash}:${String(code).trim()}`));
  await col.updateOne({ phoneHash }, { $set: ok ? { consumedAt: new Date() } : { attempts: row.attempts + 1 } });
  return ok ? "ok" : row.attempts + 1 >= OTP_MAX_ATTEMPTS ? "locked" : "invalid";
}

/** @returns {Promise<string>} the session token for the cookie (only its hash is stored). */
export async function createAuthSession(phone) {
  const token = crypto.randomBytes(32).toString("base64url");
  const now = new Date();
  await db().collection("auth_sessions").insertOne({
    tokenHash: sha256(token),
    phoneHash: lookupHash(phone),
    phoneEnc: encrypt(phone),
    createdAt: now,
    expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
    revokedAt: null,
  });
  return token;
}

/** @returns {Promise<{phone: string} | null>} */
export async function readAuthSession(token) {
  if (!token) return null;
  const row = await db().collection("auth_sessions").findOne({ tokenHash: sha256(token) });
  if (!row || row.revokedAt || row.expiresAt < new Date()) return null;
  try {
    return { phone: decrypt(row.phoneEnc) };
  } catch {
    return null; // key rotated or data tampered with
  }
}

export async function revokeAuthSession(token) {
  if (!token) return;
  await db().collection("auth_sessions").updateOne({ tokenHash: sha256(token) }, { $set: { revokedAt: new Date() } });
}
