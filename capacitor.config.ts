import type { CapacitorConfig } from '@capacitor/cli';

// This app has server components, API routes, and cookie-based auth — it
// can't be exported as static files, so the native shell loads the live
// deployment instead of bundling a local build. `webDir: 'public'` above
// is never actually served; Capacitor still requires it to point somewhere
// that exists on disk.
const config: CapacitorConfig = {
  appId: 'uk.co.myfitpod.app',
  appName: 'My Fit Pod',
  webDir: 'public',
  server: {
    // Switched from podhq-client.vercel.app 2026-09-08, once
    // myfitpod.app was registered and confirmed working (real login,
    // real Hove data) via Vercel Domains.
    url: 'https://myfitpod.app',
    androidScheme: 'https',
    cleartext: false,
  },
};

export default config;
