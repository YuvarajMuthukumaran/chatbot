// Outbound messages: login codes and appointment confirmations.
// Messages never contain health information — only who, when and where.
//
// Providers are chosen by environment (all optional; unset = log only in
// development, and skip silently in production):
//   SMS_PROVIDER=msg91     MSG91_AUTH_KEY, MSG91_SENDER_ID, MSG91_OTP_TEMPLATE_ID, MSG91_BOOKING_TEMPLATE_ID
//   SMS_PROVIDER=twilio    TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM
//   WHATSAPP_PROVIDER=meta WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_BOOKING_TEMPLATE (approved template name)
// Indian SMS needs DLT-registered templates, which is why MSG91 uses template IDs.

import { sendMail } from "./mailer.js";

const isProd = process.env.NODE_ENV === "production";
const toE164 = (phone) => `+91${String(phone).replace(/\D/g, "").slice(-10)}`;

async function post(url, body, headers) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res;
}

async function sendSms(phone, text, { templateId, variables } = {}) {
  switch (process.env.SMS_PROVIDER) {
    case "msg91":
      return post(
        "https://control.msg91.com/api/v5/flow/",
        { template_id: templateId, short_url: "0", recipients: [{ mobiles: toE164(phone).slice(1), ...variables }] },
        { authkey: process.env.MSG91_AUTH_KEY }
      );
    case "twilio": {
      const sid = process.env.TWILIO_ACCOUNT_SID;
      const auth = Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64");
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: "POST",
        headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ To: toE164(phone), From: process.env.TWILIO_FROM, Body: text }),
      });
      if (!res.ok) throw new Error(`Twilio → HTTP ${res.status}`);
      return res;
    }
    default:
      if (!isProd) console.log(`[notify:sms → ${toE164(phone).slice(0, 5)}*****] ${text}`);
  }
}

async function sendWhatsApp(phone, { template, params }) {
  if (process.env.WHATSAPP_PROVIDER !== "meta") return;
  return post(
    `https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      messaging_product: "whatsapp",
      to: toE164(phone).slice(1),
      type: "template",
      template: { name: template, language: { code: "en" }, components: [{ type: "body", parameters: params.map((text) => ({ type: "text", text })) }] },
    },
    { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` }
  );
}

export async function sendLoginCode(phone, code) {
  await sendSms(phone, `${code} is your Tulasi Healthcare login code. It expires in 5 minutes. Do not share it with anyone.`, {
    templateId: process.env.MSG91_OTP_TEMPLATE_ID,
    variables: { otp: code },
  });
}

/** Best-effort: a failed confirmation never fails the booking itself. */
export async function sendBookingConfirmation({ phone, doctorName, date, time }) {
  const when = `${date} at ${time}`;
  const text = `Your appointment with ${doctorName} on ${when} is confirmed. Tulasi Healthcare, ${process.env.CLINIC_PHONE || "+91 8800000255"}.`;
  const results = await Promise.allSettled([
    sendSms(phone, text, { templateId: process.env.MSG91_BOOKING_TEMPLATE_ID, variables: { doctor: doctorName, date, time } }),
    process.env.WHATSAPP_BOOKING_TEMPLATE ? sendWhatsApp(phone, { template: process.env.WHATSAPP_BOOKING_TEMPLATE, params: [doctorName, date, time] }) : null,
  ]);
  for (const r of results) if (r.status === "rejected") console.error("Booking confirmation failed:", r.reason?.message);
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const shell = (inner) => `<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:auto;padding:24px;color:#17222c">${inner}<p style="margin-top:28px;font-size:12px;color:#6b7782">Tulasi Healthcare · ${esc(process.env.CLINIC_PHONE || "+91 8800000255")}</p></div>`;

/** 6-digit login / booking verification code by e-mail. */
export async function sendLoginCodeEmail(email, code) {
  await sendMail({
    to: email,
    subject: `${code} is your Tulasi Healthcare verification code`,
    text: `${code} is your Tulasi Healthcare verification code. It expires in 5 minutes. Do not share it with anyone.`,
    html: shell(`<p style="font-size:15px">Your Tulasi Healthcare verification code is</p><p style="font-size:34px;letter-spacing:8px;font-weight:700;margin:8px 0">${esc(code)}</p><p style="font-size:13px;color:#4b5963">It expires in 5 minutes. Please do not share it with anyone.</p>`),
  });
}

/** Best-effort: a failed e-mail never fails the booking itself. */
export async function sendBookingConfirmationEmail({ email, patientName, doctorName, date, time }) {
  try {
    const when = `${date} at ${time}`;
    await sendMail({
      to: email,
      subject: `Your appointment with ${doctorName} is confirmed`,
      text: `Hello ${patientName}, your appointment with ${doctorName} on ${when} is confirmed. Tulasi Healthcare, ${process.env.CLINIC_PHONE || "+91 8800000255"}.`,
      html: shell(`<p style="font-size:16px">Hello ${esc(patientName)},</p><p style="font-size:15px">Your appointment with <strong>${esc(doctorName)}</strong> is confirmed for <strong>${esc(when)}</strong>.</p><p style="font-size:13px;color:#4b5963">To change or cancel it, sign in to the patient portal on our website with this e-mail address.</p>`),
    });
  } catch (err) {
    console.error("Booking confirmation e-mail failed:", err?.message);
  }
}
