import { MongoClient } from "mongodb";

// TEMP: mock DB only, move to env before prod
// Direct (non-+srv) form of the Atlas connection string — the driver's
// mongodb+srv:// scheme needs a raw SRV/TXT DNS lookup at connect time,
// which some sandboxed/restricted networks block outright even though
// normal HTTPS traffic works fine. This spells out the actual shard hosts
// and replica set (resolved once via DNS-over-HTTPS) so it connects the
// same way in any environment. Original form, for reference:
// mongodb+srv://yuvarajmuthukumaran:Hxa7a47Q8HWs7Z2k@cluster0.dptw3ke.mongodb.net/?appName=Cluster0
const MONGODB_URI =
  "mongodb://yuvarajmuthukumaran:Hxa7a47Q8HWs7Z2k@ac-l94jddb-shard-00-00.dptw3ke.mongodb.net:27017,ac-l94jddb-shard-00-01.dptw3ke.mongodb.net:27017,ac-l94jddb-shard-00-02.dptw3ke.mongodb.net:27017/?replicaSet=atlas-p5qr7i-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Cluster0";
const DB_NAME = "tulasi_test";

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 3000;

let client = null;
let db = null;
let connectingPromise = null;

async function ensureIndexes(database) {
  await database.collection("doctors").createIndex({ name: 1 });
  await database.collection("doctors").createIndex({ specialties: 1 });
  // De-dup key for the import script's upserts, per spec ("name plus hospital").
  await database.collection("doctors").createIndex({ name: 1, hospital: 1 }, { unique: true });

  // Unique only among *booked* appointments — a cancelled slot can be
  // re-booked without a duplicate-key error, but two booked appointments
  // can never occupy the same doctor+date+time.
  await database
    .collection("appointments")
    .createIndex(
      { doctorId: 1, date: 1, time: 1 },
      { unique: true, partialFilterExpression: { status: "booked" } }
    );
  await database.collection("appointments").createIndex({ patientPhone: 1 });

  await database.collection("patients").createIndex({ phone: 1 }, { unique: true });
}

async function attemptConnect() {
  const c = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  await c.connect();
  await c.db(DB_NAME).command({ ping: 1 });
  return c;
}

/** Connects with retry, ensures indexes, and logs the outcome. Safe to call
 * more than once — later calls return the same (already-resolving) promise. */
export async function connectDB() {
  if (db) return db;
  if (connectingPromise) return connectingPromise;

  connectingPromise = (async () => {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        client = await attemptConnect();
        db = client.db(DB_NAME);
        await ensureIndexes(db);
        console.log(`[db] Connected to MongoDB Atlas (db "${DB_NAME}", attempt ${attempt}/${MAX_RETRIES}).`);
        return db;
      } catch (err) {
        console.error(`[db] Connection attempt ${attempt}/${MAX_RETRIES} failed: ${err?.message || err}`);
        if (attempt === MAX_RETRIES) {
          console.error(
            "[db] MongoDB connection failed after all retries — doctor search and appointment booking will be unavailable until this is resolved."
          );
          connectingPromise = null;
          return null;
        }
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }
  })();

  return connectingPromise;
}

/** Returns the connected db handle, or null if not (yet) connected. */
export function getDb() {
  return db;
}
