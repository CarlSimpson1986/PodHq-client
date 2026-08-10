"use client";

import { useState } from "react";

// Styled for use inside a white card-light content area (auth pages,
// 2026-08-10 redesign) — dark text/border on a light background, not the
// dark-page tokens used elsewhere in the app.
const inputClass =
  "w-full rounded-lg border border-card-light-border bg-white px-4 py-3 pr-16 text-base text-card-light-foreground placeholder:text-card-light-muted focus:border-card-light-foreground focus:outline-none";

export function PasswordInput({
  id,
  label,
  autoComplete,
  value,
  onChange,
  hint,
}: {
  id: string;
  label: string;
  autoComplete: "current-password" | "new-password";
  value: string;
  onChange: (value: string) => void;
  hint?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm text-card-light-muted">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          required
          className={inputClass}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-0 flex items-center px-4 text-sm text-card-light-muted hover:text-card-light-foreground"
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
      {hint && <p className="mt-1 text-xs text-card-light-muted">{hint}</p>}
    </div>
  );
}
