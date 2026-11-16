import type { NextConfig } from "next";

import { EMBED_ORIGINS } from "./src/lib/embed";

const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  /*
   * The browser always talks to same-origin `/api`, so the session cookie stays host-only.
   * In production Caddy routes `/api` to FastAPI before Next.js; locally this rewrite does it.
   */
  /*
   * Iframes come only from the video players a card may embed (block «Видео»).
   * Scripts are not restricted here: user content is never HTML (see CLAUDE.md, «Безопасность»).
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: `frame-src ${EMBED_ORIGINS.join(" ")}` },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${API_INTERNAL_URL}/api/:path*` },
      // Uploaded files (avatars, resumes); in production Caddy serves them directly.
      { source: "/media/:path*", destination: `${API_INTERNAL_URL}/media/:path*` },
    ];
  },
};

export default nextConfig;
