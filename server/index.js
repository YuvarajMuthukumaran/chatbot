import "dotenv/config";
import { app } from "./app.js";
import { connectDB } from "./lib/db.js";
import { importDoctors } from "./scripts/importDoctors.js";

const port = process.env.PORT || 8788;

// Last line of defense: every route handles its own async errors, but if
// one ever slips through, log it rather than letting Node exit — a crash
// would also wipe every in-memory chat session.
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
});

app.listen(port, () => {
  console.log(`Tulasi server listening on http://localhost:${port}`);
});

// Connecting is best-effort and non-blocking: the core chat/crisis features
// don't depend on Mongo, so a slow or failed DB connection shouldn't delay
// or take down the whole server. Doctor search/booking routes check
// getDb() themselves and return 503 until this resolves.
connectDB().then((db) => {
  // Keep the doctor directory in step with lib/doctors.js on every deploy, so a new doctor or
  // specialty tag reaches booking without anyone remembering to run the importer by hand.
  // Opt out with SYNC_DOCTORS_ON_BOOT=0.
  if (!db || process.env.SYNC_DOCTORS_ON_BOOT === "0") return;
  importDoctors()
    .then((r) => console.log(`[doctors] Directory synced on boot: ${r.upserted} added, ${r.updated} refreshed.`))
    .catch((err) => console.error("[doctors] Boot sync failed:", err?.message || err));
});
