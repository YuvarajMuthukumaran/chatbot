// In local dev, requests always go through Vite's dev-server proxy (see
// vite.config.js) — even if a client/.env sets VITE_API_URL, which used to
// send `npm run dev` straight to the production backend, where CORS blocked
// it. To develop against a remote backend, set API_PROXY_TARGET instead.
// A static production build has no proxy, so it needs the deployed
// backend's absolute URL: VITE_API_URL at build time (client/.env.production).
export const API_BASE = import.meta.env.DEV ? "" : import.meta.env.VITE_API_URL || "";
