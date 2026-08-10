import type { NextConfig } from "next";

// Sent on every response. These are cheap defence-in-depth: they limit what an
// injected script could do and stop the app being framed by another site.
const securityHeaders = [
  // Block rendering inside a frame on another origin (clickjacking).
  { key: "X-Frame-Options", value: "DENY" },
  // Do not let browsers second-guess declared content types.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Do not leak invoice or customer ids in the Referer header to other sites.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // No part of this app needs these device APIs.
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
  // Force HTTPS for two years, including subdomains.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
