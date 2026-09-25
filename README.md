# YUVARAJ — Tulasi Health Care's Mental Health Support Companion

A support chatbot with a React + Tailwind frontend and an Express backend that
proxies all LLM calls through Groq (the API key never reaches the browser).

## Structure

- `server/` — Express API: session management, crisis detection (hard-coded,
  runs before any model call), and the Groq proxy (streamed via SSE), with
  an automatic model fallback chain for reliability.
- `client/` — Vite + React + Tailwind frontend: Home, Chat, Resources, About
  pages, persistent "Get Immediate Help" button, onboarding, mood check-in.

## Running locally

```bash
cd server
cp .env.example .env   # fill in GROQ_API_KEY
npm install
npm run dev             # http://localhost:8788
```

```bash
cd client
npm install
npm run dev             # http://localhost:5173 (proxies /api to the server)
```

## Safety design notes

- **Crisis detection is deterministic**, not left to model judgment: see
  `server/lib/crisisDetection.js`. A match short-circuits the model call
  entirely and returns the fixed template in `server/lib/crisisTemplate.js`.
- **Crisis hotlines are region-configurable** via `CRISIS_REGION` in
  `server/.env` (see `server/lib/crisisResources.js` for supported regions).
- **The Groq API key lives only in `server/.env`**, which is git-ignored.
  It's read server-side and never sent to the client.
- No gamification, streaks, or re-engagement notifications by design.

## Reliability & efficiency notes

- **Model fallback chain** (`server/lib/llmClient.js`): on a 429/502/503/504
  from the primary model, the request automatically retries against
  `GROQ_MODEL_FALLBACKS` (comma-separated, tried in order) instead of
  immediately showing the user an error — Groq's free tier rate-limits per
  model, so a different model is usually available even if one is throttled.
- **History is trimmed** to the last `MAX_HISTORY_TURNS` turns per call,
  since the chat endpoint is stateless and replays the full conversation
  every request — this bounds latency/cost as a conversation grows.
- **Stale requests are aborted**: if a new message arrives for a session
  before the previous reply finished streaming (or the client disconnects),
  the in-flight model call is cancelled via `AbortController` instead of
  paying for a response nobody will see.
- **Failed turns aren't persisted** to session history — only a
  successfully completed (or crisis-template) exchange is recorded, so a
  retry after a transient failure doesn't corrupt the user/assistant
  alternation the model expects.
- The client shows a **Retry** button on a failed message instead of
  requiring the user to retype it.
- **Markdown is normalized before rendering** (`client/src/lib/markdown.js`):
  models sometimes emit bold/italic markers with whitespace touching the
  inner edge (invalid CommonMark), which would otherwise show literal
  asterisks to the user.

## Before production

- Verify `GROQ_MODEL` / `GROQ_MODEL_FALLBACKS` in `server/.env` against
  what's actually available on your Groq plan — see
  https://console.groq.com/docs/models.
- Swap the in-memory session store (`server/lib/sessionStore.js`) for a real
  database if sessions need to survive server restarts or scale beyond one
  process.
- Add encryption-at-rest for any persisted conversation data, and confirm
  your data retention/deletion policy is reflected in `client/src/pages/About.jsx`.
- Rotate the Groq API key if it was ever pasted into a chat, ticket, or any
  other non-secret channel before landing in `.env`.
