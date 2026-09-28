// Loads the scraped Tulasi Health Care doctor directory (server/lib/doctors.js
// — originally scraped from tulasihealthcare.com/our-team) into the MongoDB
// `doctors` collection. Safe to re-run: upserts on (name, hospital), the
// same unique key the collection's index enforces, so re-running never
// creates duplicates and just refreshes the data.
import { connectDB } from "../lib/db.js";
import { DOCTORS } from "../lib/doctors.js";

const HOSPITAL = "Tulasi Health Care";
const LOCATION = "Tulasi Health Care"; // single-location directory today; kept as its own field for when that changes

export async function importDoctors() {
  const db = await connectDB();
  if (!db) throw new Error("Could not connect to MongoDB — see connection logs.");

  const collection = db.collection("doctors");
  let upserted = 0;
  let matched = 0;

  for (const doc of DOCTORS) {
    const result = await collection.updateOne(
      { name: doc.name, hospital: HOSPITAL },
      {
        $set: {
          name: doc.name,
          role: doc.role,
          specialties: doc.specialties || [],
          focus: doc.focus || "",
          photo: doc.photo || null,
          hospital: HOSPITAL,
          location: LOCATION,
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true }
    );
    if (result.upsertedCount > 0) upserted++;
    else matched++;
  }

  return { total: DOCTORS.length, upserted, updated: matched };
}

// Allow running directly: node scripts/importDoctors.js
if (import.meta.url === `file://${process.argv[1]}`) {
  importDoctors()
    .then((summary) => {
      console.log(`Doctor import complete: ${summary.upserted} inserted, ${summary.updated} updated, ${summary.total} total.`);
      process.exit(0);
    })
    .catch((err) => {
      console.error("Doctor import failed:", err?.message || err);
      process.exit(1);
    });
}
