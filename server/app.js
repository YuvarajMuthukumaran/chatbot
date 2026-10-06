// The Express app itself, separate from index.js (which starts it) so the
// test suite can exercise the real routes on a throwaway port.
import express from "express";
import cors from "cors";
import sessionRoutes from "./routes/session.js";
import chatRoutes from "./routes/chat.js";
import doctorsRoutes from "./routes/doctors.js";
import appointmentsRoutes from "./routes/appointments.js";
import authRoutes from "./routes/auth.js";
import matchRoutes from "./routes/match.js";
import medicinesRoutes from "./routes/medicines.js";
import { getDb, getLastDbError } from "./lib/db.js";
import { getApiKey, getLastLlmError } from "./lib/llmClient.js";

export const app = express();

const allowedOrigins = (process.env.CLIENT_ORIGIN || "https://chatbot-tulasi.vercel.app")
  .split(",")
  .map((o) => o.trim());

// Behind a host's load balancer (Render, etc.) every request would otherwise
// appear to come from the proxy's own address, putting all users into one
// shared rate-limit bucket. TRUST_PROXY is the number of proxy hops in front
// of the app (0 when it's exposed directly).
app.set("trust proxy", Number(process.env.TRUST_PROXY ?? 1));
app.disable("x-powered-by");

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Frame-Options", "DENY");
  next();
});
// credentials: the website's patient portal sends its httpOnly session cookie.
app.use(cors({ origin: allowedOrigins, credentials: true }));
// Room for a restored conversation (POST /api/session: up to 20 turns, and
// Indic scripts take 3 bytes a character); chat messages themselves are
// capped separately (routes/chat.js).
app.use(express.json({ limit: "128kb" }));

app.get("/api/health", (req, res) => res.json({ ok: true }));
// Diagnostic only, while wiring up the test MongoDB connection — no
// credentials exposed, just the connection state and last error message.
app.get("/api/db-status", (req, res) => res.json({ connected: !!getDb(), lastError: getLastDbError() }));
// Diagnostic only — the chat-facing fallback text is deliberately vague, so
// this is the only way to tell a rate limit apart from an auth/config
// problem without shell access to the deployment. No key material exposed.
app.get("/api/llm-status", (req, res) =>
  res.json({ apiKeyConfigured: !!getApiKey(), lastError: getLastLlmError() })
);

app.use("/api", sessionRoutes);
app.use("/api", chatRoutes);
app.use("/api", doctorsRoutes);
app.use("/api", appointmentsRoutes);
app.use("/api", authRoutes);
app.use("/api", matchRoutes);
app.use("/api", medicinesRoutes);

app.use((err, req, res, next) => {
  if (err?.type === "entity.too.large") {
    return res.status(413).json({ error: "That request was too large." });
  }
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Malformed JSON in request body." });
  }
  console.error(err);
  if (res.headersSent) return res.end();
  res.status(500).json({ error: "Something went wrong. Please try again shortly." });
});
