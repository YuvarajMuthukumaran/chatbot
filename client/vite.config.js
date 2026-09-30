import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        // The local API server by default. Point local dev at a deployed
        // backend with API_PROXY_TARGET=https://your-api.onrender.com —
        // proxied server-side, so no CORS setup is needed.
        target: process.env.API_PROXY_TARGET || "http://localhost:8788",
        changeOrigin: true,
      },
    },
  },
});
