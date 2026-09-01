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
    url: 'https://podhq-client.vercel.app',
    androidScheme: 'https',
    cleartext: false,
  },
};

export default config;
