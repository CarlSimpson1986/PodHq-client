"use client";

import { useEffect } from "react";

// Catches an error thrown by the root layout itself (error.tsx can't —
// it renders *inside* the layout, so a layout-level crash bypasses it
// entirely). Must render its own <html>/<body>, since a layout crash
// means the real layout.tsx never rendered — Next's documented pattern
// for this file. Kept deliberately inline-styled rather than relying on
// globals.css/Tailwind classes: those come from layout.tsx too, so this
// is the one place in the app that can't assume the normal styling
// pipeline is even available.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[global error boundary]", { message: error.message, digest: error.digest });
  }, [error]);

  return (
    <html lang="en-GB">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "24px",
          background: "#0a0a0b",
          color: "#f5f5f5",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div style={{ maxWidth: "360px" }}>
          <p style={{ fontSize: "16px", fontWeight: 600 }}>Something went wrong</p>
          <p style={{ marginTop: "8px", fontSize: "14px", color: "#a1a1aa" }}>
            The app couldn&apos;t load. Give it another try — if it keeps happening, let gym staff know.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "16px",
              width: "100%",
              borderRadius: "8px",
              border: "none",
              background: "#f5f5f5",
              color: "#0a0a0b",
              padding: "10px 16px",
              fontSize: "14px",
              fontWeight: 600,
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
