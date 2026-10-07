// Outbound e-mail (login codes and booking confirmations).
//
// Preferred, works on hosts that block SMTP (Render's free plan does): Brevo's HTTPS API.
//   BREVO_API_KEY      an API key (Brevo > SMTP & API > API keys)
//   MAIL_FROM_EMAIL    a sender address verified in Brevo (Senders, domains & dedicated IPs > Senders)
// Fallback, for hosts that allow SMTP: a Gmail account with a Google "App password".
//   GMAIL_USER, GMAIL_APP_PASSWORD
// Optional: MAIL_FROM_NAME (default "Tulasi Healthcare").
// Nothing set: in development the message is only logged; in production sending fails with a clear error.
import nodemailer from "nodemailer";

const isProd = process.env.NODE_ENV === "production";
const TIMEOUT_MS = 12_000;
let transport;

const useBrevo = () => Boolean(process.env.BREVO_API_KEY && (process.env.MAIL_FROM_EMAIL || process.env.GMAIL_USER));
const useGmail = () => Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
export const mailConfigured = () => useBrevo() || useGmail();

const fromName = () => process.env.MAIL_FROM_NAME || "Tulasi Healthcare";

function getTransport() {
  transport ??= nodemailer.createTransport({
    service: "gmail",
    connectionTimeout: TIMEOUT_MS,
    greetingTimeout: TIMEOUT_MS,
    socketTimeout: TIMEOUT_MS,
    auth: { user: process.env.GMAIL_USER, pass: String(process.env.GMAIL_APP_PASSWORD).replace(/\s+/g, "") },
  });
  return transport;
}

async function sendWithBrevo({ to, subject, text, html }) {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": process.env.BREVO_API_KEY, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { name: fromName(), email: process.env.MAIL_FROM_EMAIL || process.env.GMAIL_USER },
      to: [{ email: to }],
      subject,
      textContent: text,
      htmlContent: html,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Brevo responded ${res.status}: ${detail.slice(0, 200)}`);
  }
}

/** Sends one message. Messages never contain health information, only who, when and where. */
export async function sendMail({ to, subject, text, html }) {
  if (!mailConfigured()) {
    if (isProd) throw Object.assign(new Error("E-mail is not configured on the server."), { status: 503 });
    console.log(`[mail → ${to}] ${subject}\n${text}`);
    return;
  }
  if (useBrevo()) return sendWithBrevo({ to, subject, text, html });
  await getTransport().sendMail({ from: `"${fromName()}" <${process.env.GMAIL_USER}>`, to, subject, text, html });
}
