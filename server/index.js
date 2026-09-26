import "dotenv/config";
import express from "express";
import cors from "cors";
import sessionRoutes from "./routes/session.js";
import chatRoutes from "./routes/chat.js";

const app = express();
const port = process.env.PORT || 8787;
const allowedOrigins = (process.env.CLIENT_ORIGIN || "https://chatbot-tulasi.vercel.app")
  .split(",")
  .map((o) => o.trim());

app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: "32kb" }));

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use("/api", sessionRoutes);
app.use("/api", chatRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong. Please try again shortly." });
});

app.listen(port, () => {
  console.log(`Tulasi server listening on http://localhost:${port}`);
});
