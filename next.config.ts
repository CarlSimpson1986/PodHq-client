import type { NextConfig } from "next";

// Content-Security-Policy is set per-request in src/proxy.ts instead of
// here — it needs a fresh nonce on every request, which a static config
// value can't provide.
const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-XSS-Protection", value: "1; mode=block" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    // geolocation=(self), not (): the pod-unlock location gate (Stage 7)
    // needs it for our own origin. camera/microphone stay disabled, unused.
    // push/notifications aren't currently enforced via Permissions-Policy
    // by any shipping browser, but explicitly allowing them costs nothing
    // and avoids relying on that staying true — the exact same silent,
    // zero-console-warning failure mode geolocation=() once caused here.
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(self), push=(self), notifications=(self)",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
