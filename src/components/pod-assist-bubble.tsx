"use client";

import { useState } from "react";
import Image from "next/image";
import { HelpChatView } from "@/components/help-chat-view";

// Pod Assist's floating bubble, extracted from onboarding-tour.tsx
// (2026-09-01) so every non-premium page can mount it, not just Home —
// its own tour copy already said "tap here any time". The guided
// first-login tour (driver.js) stays Home-only and wraps this component
// rather than duplicating it, passing its own replay handler as
// `onReplayTour`; every other page renders this with no replay option
// (HelpChatView already hides that chip when the prop is undefined) since
// the tour only ever targets Home's own elements.
export function PodAssistBubble({ onReplayTour }: { onReplayTour?: () => void }) {
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <div className="fixed right-4 top-4 z-20">
      <button
        type="button"
        id="tour-help-button"
        onClick={() => setChatOpen(true)}
        aria-label="Pod Assist"
        className="flex h-10 w-10 items-center justify-center drop-shadow-lg"
      >
        <Image src="/icons/features/pod-assist-mark.png" alt="" width={40} height={40} />
      </button>
      {chatOpen && (
        <div className="fixed inset-x-4 bottom-4 top-20 z-30 flex flex-col overflow-hidden rounded-2xl border border-card-light-border bg-card-light shadow-2xl sm:inset-x-auto sm:right-4 sm:w-96">
          <div className="flex items-center justify-between border-b border-card-light-border px-4 py-3">
            <p className="text-sm font-semibold text-card-light-foreground">Pod Assist</p>
            <button
              type="button"
              onClick={() => setChatOpen(false)}
              aria-label="Close chat"
              className="flex h-7 w-7 items-center justify-center rounded-full text-card-light-muted hover:bg-card-light-border"
            >
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <HelpChatView
              onReplayTour={
                onReplayTour &&
                (() => {
                  setChatOpen(false);
                  onReplayTour();
                })
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}
