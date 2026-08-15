import { PageHero } from "@/components/page-hero";
import { WifiOffIcon } from "@/components/icons";

// Precached by sw.js at install time and served for any navigation that
// fails while offline/on a dead connection and has no better cached match
// (see the fetch handler's navigate branch in public/sw.js). Deliberately
// static and auth-agnostic — it must render from a cached snapshot taken
// once, potentially long before whichever page the member was actually
// trying to reach.
export default function OfflinePage() {
  return (
    <main className="flex min-h-full flex-1 flex-col">
      <PageHero title="You're offline" subtitle="My Fit Pod" icon={WifiOffIcon} />
      <div className="card-light flex-1 px-6 pb-10 pt-8">
        <div className="mx-auto w-full max-w-md space-y-4 text-card-light-foreground">
          <p>
            We can&apos;t reach My Fit Pod right now — check your signal or Wi-Fi and try
            again.
          </p>
          <p className="text-sm text-card-light-muted">
            Anything you&apos;ve already loaded on this device (like your booking QR code)
            should still be visible if you go back to it.
          </p>
        </div>
      </div>
    </main>
  );
}
