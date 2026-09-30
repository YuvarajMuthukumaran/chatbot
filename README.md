# Tulasi — Tulasi Health Care's Mental Health Support Companion

A support chatbot with a React + Tailwind frontend and an Express backend.
Conversation is handled by an LLM through Groq (the API key never reaches
the browser); everything safety- or data-critical is plain, deterministic
code that runs *before* the model is involved.

## What it does

- **Supportive conversation** in English, Hindi, Tamil, and Telugu (native
  script and romanized), streamed from Groq with a model fallback chain.
- **Crisis detection** — a deterministic phrase gate in all four languages
  that short-circuits the model and returns a fixed, hand-written template.
- **Doctor recommendations** — specialist cards (with a Book button) when
  someone asks for help or shows real distress.
- **Appointment booking in chat** — book, view, reschedule, cancel, with
  tappable quick replies (doctors, dates, times, yes/no) and a confirmation
  step. Also available as pages: *Find a Doctor* and *My Appointments*.
- **Patient records** from the hospital HMS (admission status, discharge
  summary, prescriptions, visit history) after an identity check.

## Structure

- `server/` — Express API. `app.js` builds the app, `index.js` starts it.
  - `lib/turnRouter.js` — the order every message goes through: crisis
    detection → leaving a stuck flow → HMS flow → booking flow → LLM.
  - `lib/bookingFlow.js`, `lib/hmsFlow.js` — the deterministic flows.
  - `lib/dateParse.js`, `lib/clinicTime.js` — free-text dates/times and
    clinic-timezone logic.
  - `scripts/sandbox.js` — local server on an in-memory DB + stub HMS.
- `client/` — Vite + React + Tailwind. Pages: Chat, Find a Doctor, Doctor
  profile/booking, My Appointments; persistent "Get Immediate Help" button.

## Running locally

```bash
cd server
cp .env.example .env   # fill in GROQ_API_KEY and MONGODB_URI
npm install
npm run dev            # http://localhost:8788
```

```bash
cd client
npm install
npm run dev            # http://localhost:5173 (proxies /api to the server)
```

**Sandbox mode** — to try booking and records without touching real data:

```bash
cd server
npm run dev:sandbox
```

This runs the real server against an in-memory database (seeded with the
doctor directory) and a stub HMS. Use it for demos and manual testing:
`npm run dev` writes to the same MongoDB database the deployed app uses, and
the real HMS *creates a patient record* whenever a records lookup doesn't
match. The demo patient is "Asha Verma", any age, phone 9999999999.

To point local client dev at a deployed backend instead of a local one, run
it with `API_PROXY_TARGET=https://your-api.onrender.com` (proxied, so no CORS
setup is needed).

## Tests

```bash
cd server && npm test   # needs Node 22.3+
cd client && npm test
```

The server suite covers crisis detection in all four languages (including
false positives), date/time parsing, every booking and records flow end to
end on the in-memory database, and the HTTP API (validation, rate limits,
response shapes).

## Deploying

- **Server (Render):** for the test deployment, the Groq key and MongoDB
  connection string can be built in: `TEST_GROQ_API_KEY` in
  `server/lib/llmClient.js` and `TEST_MONGODB_URI` in `server/lib/db.js`.
  `GROQ_API_KEY` / `MONGODB_URI` in the service's Environment settings
  override them. See `server/.env.example` for everything else
  (`CLIENT_ORIGIN`, `ADMIN_TOKEN`, `CLINIC_TIMEZONE`, ...).
  `GET /api/llm-status` and `GET /api/db-status` show whether each is
  configured and working.
- **Client (Vercel):** `client/.env.production` sets `VITE_API_URL`;
  `vercel.json` handles client-side routes.
- **Doctor directory:** `server/lib/doctors.js` is the source of truth. After
  editing it, run `npm run import-doctors` (or `POST /api/doctors/import`
  with an `X-Admin-Token` header matching `ADMIN_TOKEN`).

## Safety design notes

- **Crisis detection is deterministic**, not left to model judgment: see
  `server/lib/crisisDetection.js`. A match short-circuits the model call
  entirely, ends any half-finished booking/records flow, and returns the
  fixed template in `server/lib/crisisTemplate.js` — shown instantly, never
  typed out. The system prompt also tells the model how to respond if
  something slips past the phrase list.
- **Crisis hotlines are region-configurable** via `CRISIS_REGION` (see
  `server/lib/crisisResources.js`).
- **A form never swallows distress**: an emotional message sent mid-flow
  leaves the flow and gets a real reply; "never mind" stops it plainly.
- No gamification, streaks, or re-engagement notifications by design.

## Privacy & security notes

- **Test credentials may be built into the code** for the test deployment
  (see *Deploying*); environment variables override them. For production,
  keep them out of the code and use the environment only.
- **Booking and records turns are never sent to the LLM.** They're stored as
  private history; the model only sees a note that the feature was used
  (plus, for bookings, which doctor and when — no names or numbers).
- **HMS verification only counts a real match.** The HMS "patient match" API
  registers a new patient when nothing matches; that response is no longer
  treated as proof of identity. Three failed attempts lock records lookups
  for the conversation, and registration itself is handed to the front desk.
- **Rate limits** (per client IP) on chat, session creation, phone-number
  lookups, bookings, and HMS verification.
- **Conversations are saved on the device** (localStorage), so people can
  close the tab and pick up where they left off days later; open tabs stay in
  sync. **New chat** deletes the saved conversation (worth knowing on shared
  or family devices). Hospital records shown in chat are *not* saved — after
  a reload they appear as a short note, so nobody can read them later on the
  same device without passing the identity check. Server sessions still
  expire after 12 idle hours; the saved copy restores their context.
- All user input used in database searches is escaped (a stray `(` used to
  crash the server).

## Reliability notes

- **Model fallback chain** (`server/lib/llmClient.js`): on a 429/502/503/504
  from the primary model, the request retries against `GROQ_MODEL_FALLBACKS`.
- **Sessions survive server restarts**: if the server lost a session (a
  restart, the host spinning down while idle, or someone returning days
  later), the client transparently starts a new one seeded with the saved
  conversation.
- **History is trimmed** to the last `MAX_HISTORY_TURNS` turns per call.
- **Stale requests are aborted** when a newer message arrives or the client
  disconnects, and **failed turns aren't persisted**, so a Retry starts clean.
- **Clinic time, not server time**: "today", "tomorrow", and which slots have
  passed are decided in `CLINIC_TIMEZONE` (IST by default).

## Before production

- **Take the test credentials out of the code and rotate them.** Anything
  committed to this public repository (including its history) is readable
  by anyone; production keys belong only in the host's environment settings.
- **Verify phone numbers with an OTP** before showing, cancelling, or
  rescheduling appointments. Today anyone who knows a number can see which
  doctors (psychiatrists) that person is booked with — rate limits slow this
  down but don't prevent it.
- **Confirm the HMS identity check with the hospital's IT team**: the API
  matches on an exact date of birth but the chat asks for age (sent as
  1 January of the birth year), so real patients will rarely match — and each
  miss creates a new record in the HMS. Either collect the full date of birth
  or get a match-only endpoint.
- Swap the in-memory session store (`server/lib/sessionStore.js`) for a real
  database if sessions need to survive restarts server-side or scale beyond
  one process (the rate limiters are in-memory too).
- Have native speakers review the Hindi/Tamil/Telugu crisis phrases and
  templates.
