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
    // Found 2026-09-09: myfitpod.app (apex) 308-redirects to
    // www.myfitpod.app at the Vercel level. Capacitor's native bridge only
    // injects into pages matching this exact configured authority -- once
    // the WebView follows that redirect, it lands on a domain Capacitor
    // doesn't recognise as its own app, so window.Capacitor (and every
    // plugin bridge -- push, Health Connect, everything) never existed at
    // all, on every single page load. Pointing directly at the real
    // canonical domain skips the redirect hop entirely.
    url: 'https://www.myfitpod.app',
    androidScheme: 'https',
    cleartext: false,
  },
};

export default config;
