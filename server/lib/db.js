import { MongoClient } from "mongodb";

// Test deployment: paste the test database's connection string between the
// quotes below so the app runs with no environment setup; MONGODB_URI, when
// set, overrides it. Before production, empty this again, rotate the
// password, and use the environment only.
//
// Tip: the direct (non-+srv) form works on networks that block the SRV/TXT
// DNS lookup mongodb+srv:// needs. tls=true must be explicit in that form,
// since only mongodb+srv:// implies it, and Atlas refuses unencrypted
// connections.
const TEST_MONGODB_URI = "mongodb://yuvarajmuthukumaran:Hxa7a47Q8HWs7Z2k@ac-l94jddb-shard-00-00.dptw3ke.mongodb.net:27017,ac-l94jddb-shard-00-01.dptw3ke.mongodb.net:27017,ac-l94jddb-shard-00-02.dptw3ke.mongodb.net:27017/?replicaSet=atlas-p5qr7i-shard-0&authSource=admin&retryWrites=true&w=majority&tls=true&appName=Cluster0";
const MONGODB_URI = process.env.MONGODB_URI ?? TEST_MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB || "tulasi_test";

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 3000;

let client = null;
let db = null;
let connectingPromise = null;
let lastError = null;

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

  if (!MONGODB_URI) {
    lastError = "MONGODB_URI is not set. Add it to server/.env (or the host's environment settings).";
    console.error(`[db] ${lastError} Doctor search and appointment booking will be unavailable.`);
    return null;
  }

  connectingPromise = (async () => {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        client = await attemptConnect();
        db = client.db(DB_NAME);
        await ensureIndexes(db);
        console.log(`[db] Connected to MongoDB Atlas (db "${DB_NAME}", attempt ${attempt}/${MAX_RETRIES}).`);
        return db;
      } catch (err) {
        lastError = err?.message || String(err);
        console.error(`[db] Connection attempt ${attempt}/${MAX_RETRIES} failed: ${lastError}`);
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

/** Swaps in a database handle directly (an in-memory fake, for tests and
 * `npm run dev:sandbox`) so that local experiments never write test bookings
 * into the shared database the deployed app also uses. */
export async function setDb(database) {
  db = database;
  if (database) await ensureIndexes(database);
}

/** Diagnostic only — the message from the most recent failed connection attempt. */
export function getLastDbError() {
  return lastError;
}
