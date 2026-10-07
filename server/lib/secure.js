// Field-level protection for sensitive data at rest.
//   encrypt/decrypt: AES-256-GCM (random IV per value, authenticated).
//   lookupHash: keyed HMAC-SHA256, so a phone number can be looked up
//   without being stored in the clear.
// Keys come from the environment and never leave the server:
//   DATA_ENCRYPTION_KEY  32 random bytes, base64  (openssl rand -base64 32)
//   LOOKUP_HASH_KEY      32 random bytes, base64
import crypto from "node:crypto";

function keyFrom(name) {
  const raw = process.env[name];
  if (raw) {
    const key = Buffer.from(raw, "base64");
    if (key.length !== 32) throw new Error(`${name} must be 32 bytes, base64-encoded`);
    return key;
  }
  if (process.env.NODE_ENV === "production") throw new Error(`${name} is required in production`);
  // Development/sandbox only: a per-process key (data won't survive a restart).
  console.warn(`[secure] ${name} not set; using a temporary development key.`);
  return crypto.randomBytes(32);
}

let encKey, hashKey;
const enc = () => (encKey ??= keyFrom("DATA_ENCRYPTION_KEY"));
const hk = () => (hashKey ??= keyFrom("LOOKUP_HASH_KEY"));

export function encrypt(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", enc(), iv);
  const data = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  return `v1:${iv.toString("base64")}:${cipher.getAuthTag().toString("base64")}:${data.toString("base64")}`;
}

export function decrypt(token) {
  const [v, iv, tag, data] = String(token).split(":");
  if (v !== "v1") throw new Error("Unknown ciphertext version");
  const decipher = crypto.createDecipheriv("aes-256-gcm", enc(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}

export const lookupHash = (value) => crypto.createHmac("sha256", hk()).update(String(value)).digest("hex");

/** SHA-256 of a random secret (session tokens, OTP codes): the secret itself is never stored. */
export const sha256 = (value) => crypto.createHash("sha256").update(String(value)).digest("hex");

/** Constant-time comparison of two hex digests. */
export function safeEqualHex(a, b) {
  const x = Buffer.from(String(a), "hex");
  const y = Buffer.from(String(b), "hex");
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export const maskPhone = (phone) => `******${String(phone).slice(-4)}`;

/** "priya.sharma@gmail.com" -> "p***a@gmail.com" */
export const maskEmail = (email) => {
  const [user = "", domain = ""] = String(email).split("@");
  return `${user.slice(0, 1)}${"*".repeat(Math.max(2, Math.min(user.length - 2, 5)))}${user.length > 1 ? user.slice(-1) : ""}@${domain}`;
};
