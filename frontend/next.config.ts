import type { NextConfig } from "next";

/**
 * Where this server can reach the Express API. Locally that is the dev API; on
 * Railway it is the API service's private address, for example
 * http://backend.railway.internal:4000. Rewrites are compiled at build time, so
 * the variable must be set when the app is built.
 */
const apiOrigin = (process.env.API_INTERNAL_URL ?? "http://localhost:4000").replace(/\/+$/, "");

const nextConfig: NextConfig = {
  // Browsers only ever talk to this app. Everything under /api is forwarded to
  // the API, which keeps the session cookie first-party: Safari and iOS block
  // cookies set by a different site.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiOrigin}/api/:path*` }];
  },
};

export default nextConfig;
