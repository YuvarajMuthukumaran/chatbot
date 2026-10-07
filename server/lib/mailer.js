// Outbound e-mail through a Gmail account (login codes and booking confirmations).
//   GMAIL_USER           the sending address, e.g. clinic@gmail.com
//   GMAIL_APP_PASSWORD   a Google "App password" (Account > Security > 2-Step Verification > App passwords)
//   MAIL_FROM_NAME       optional display name (default "Tulasi Healthcare")
// Not set: in development the message is only logged; in production sending fails with a clear error.
import nodemailer from "nodemailer";

const isProd = process.env.NODE_ENV === "production";
let transport;

export const mailConfigured = () => Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);

function getTransport() {
  transport ??= nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.GMAIL_USER, pass: String(process.env.GMAIL_APP_PASSWORD).replace(/\s+/g, "") },
  });
  return transport;
}

/** Sends one message. Messages never contain health information, only who, when and where. */
export async function sendMail({ to, subject, text, html }) {
  if (!mailConfigured()) {
    if (isProd) throw Object.assign(new Error("E-mail is not configured on the server."), { status: 503 });
    console.log(`[mail \u2192 ${to}] ${subject}\n${text}`);
    return;
  }
  await getTransport().sendMail({
    from: `"${process.env.MAIL_FROM_NAME || "Tulasi Healthcare"}" <${process.env.GMAIL_USER}>`,
    to,
    subject,
    text,
    html,
  });
}
