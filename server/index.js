import "dotenv/config";
import express from "express";
import cors from "cors";
import sessionRoutes from "./routes/session.js";
import chatRoutes from "./routes/chat.js";
import doctorsRoutes from "./routes/doctors.js";
import appointmentsRoutes from "./routes/appointments.js";
import { connectDB, getDb, getLastDbError } from "./lib/db.js";
import { getLastLlmError } from "./lib/llmClient.js";

const app = express();
const port = process.env.PORT || 8787;
const allowedOrigins = (process.env.CLIENT_ORIGIN || "https://chatbot-tulasi.vercel.app")
  .split(",")
  .map((o) => o.trim());

app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: "32kb" }));

app.get("/api/health", (req, res) => res.json({ ok: true }));
// Diagnostic only, while wiring up the test MongoDB connection — no
// credentials exposed, just the connection state and last error message.
app.get("/api/db-status", (req, res) => res.json({ connected: !!getDb(), lastError: getLastDbError() }));
// Diagnostic only — the chat-facing fallback text is deliberately vague, so
// this is the only way to tell a rate limit apart from an auth/config
// problem without shell access to the deployment. No key material exposed.
app.get("/api/llm-status", (req, res) =>
  res.json({ apiKeyConfigured: !!process.env.GROQ_API_KEY, lastError: getLastLlmError() })
);

app.use("/api", sessionRoutes);
app.use("/api", chatRoutes);
app.use("/api", doctorsRoutes);
app.use("/api", appointmentsRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong. Please try again shortly." });
});

app.listen(port, () => {
  console.log(`Tulasi server listening on http://localhost:${port}`);
});

// Connecting is best-effort and non-blocking: the core chat/crisis features
// don't depend on Mongo, so a slow or failed DB connection shouldn't delay
// or take down the whole server. Doctor search/booking routes check
// getDb() themselves and return 503 until this resolves.
connectDB();
