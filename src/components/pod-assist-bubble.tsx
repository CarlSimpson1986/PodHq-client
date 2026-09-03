"use client";

import { useEffect, useState } from "react";
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
export function PodAssistBubble({
  onReplayTour,
  tourCtaLabel,
  welcomeMessage,
  initialOpen = false,
  onClose,
}: {
  onReplayTour?: () => void;
  tourCtaLabel?: string;
  welcomeMessage?: string;
  initialOpen?: boolean;
  onClose?: () => void;
}) {
  const [chatOpen, setChatOpen] = useState(initialOpen);
  // Two-phase mount so the panel actually transitions in from the icon's
  // corner (transform-origin top-right, matching the button's position)
  // instead of snapping straight to full size — including on the very
  // first paint when initialOpen is already true, not just on later taps.
  const [animateIn, setAnimateIn] = useState(false);

  useEffect(() => {
    if (!chatOpen) return;
    const id = requestAnimationFrame(() => setAnimateIn(true));
    return () => cancelAnimationFrame(id);
  }, [chatOpen]);

  function closeChat() {
    setChatOpen(false);
    setAnimateIn(false);
    onClose?.();
  }

  return (
    <div className="pointer-events-none absolute right-4 top-4 z-[2000000000] flex flex-col items-center gap-1">
      {/* Not fixed (2026-09-03) — it used to float over whatever scrolled
          underneath as the member scrolled down, and a white label pill
          over a white card (everything on this app is card-light) was
          unreadable. absolute + top-4 keeps it pinned to the top of the
          page's own content instead, scrolling away with everything else
          — Carl's call, over a dark backing plate that kept it fixed but
          always legible (tried and rejected, "i dfont like it"). */}
      {/* The real Pod Assist mark (2026-09-03, matched-set update) —
          Carl's source file (pod-assist-badge-full.png, kept alongside for
          anywhere a bigger app-icon-style badge is useful later) is a full
          rounded-square badge with "POD ASSIST" text baked in, same
          treatment as pod-coach-mark.png: cropped to just the glyph
          cluster (bubble-robot + question-bubble/FAQ-card/info/headset)
          with a transparent background, "Pod Assist" as text lives in the
          label span below instead. Source glyphs are ~1.32:1 (wide, not
          square), hence the non-square width/height. z-index sits above
          driver.js's own overlay/popover (1000000000) — otherwise the
          tour's dimming overlay visually buries this icon (and its glow,
          see tour-runner.tsx's setPodAssistGlow) on every step that isn't
          targeting it directly. The wrapper itself is pointer-events-none
          (re-enabled below on the actual interactive pieces) so its empty
          space can never sit in front of and swallow clicks meant for a
          tour popover positioned nearby. */}
      <button
        type="button"
        id="tour-help-button"
        onClick={() => setChatOpen(true)}
        aria-label="Pod Assist"
        className="pointer-events-auto flex h-10 w-14 items-center justify-center drop-shadow-lg"
      >
        <Image src="/icons/features/pod-assist-mark.png" alt="" width={53} height={40} />
      </button>
      {/* id targeted by the tour's final step, not #tour-help-button itself
          — that's a real interactive control (its own onClick), and
          highlighting a live clickable element right next to driver.js's
          own Done/X popover buttons is exactly the setup that made those
          buttons stop responding (competing for the same screen region).
          This label has no handler, so nothing can steal the click. */}
      <span
        id="tour-help-label"
        className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-card-light-foreground"
      >
        Pod Assist
      </span>
      {chatOpen && (
        <div
          className={`pointer-events-auto fixed inset-x-4 bottom-4 top-20 z-30 flex origin-top-right flex-col overflow-hidden rounded-2xl border border-card-light-border bg-card-light shadow-2xl transition-all duration-200 ease-out sm:inset-x-auto sm:top-auto sm:right-4 sm:h-[560px] sm:max-h-[calc(100vh-6rem)] sm:w-96 ${
            animateIn ? "scale-100 opacity-100" : "scale-95 opacity-0"
          }`}
        >
          <div className="flex items-center justify-between border-b border-card-light-border px-4 py-3">
            <p className="text-sm font-semibold text-card-light-foreground">Pod Assist</p>
            <button
              type="button"
              onClick={closeChat}
              aria-label="Close chat"
              className="flex h-7 w-7 items-center justify-center rounded-full text-card-light-muted hover:bg-card-light-border"
            >
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <HelpChatView
              welcomeMessage={welcomeMessage}
              tourCtaLabel={tourCtaLabel}
              onReplayTour={
                onReplayTour &&
                (() => {
                  closeChat();
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
