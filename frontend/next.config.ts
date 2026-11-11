import type { NextConfig } from "next";

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
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${API_INTERNAL_URL}/api/:path*` },
      // Uploaded files (avatars, resumes); in production Caddy serves them directly.
      { source: "/media/:path*", destination: `${API_INTERNAL_URL}/media/:path*` },
    ];
  },
};

export default nextConfig;
