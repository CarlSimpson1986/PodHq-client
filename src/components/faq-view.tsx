"use client";

import { useState } from "react";
import type { FaqItem } from "@/lib/faq";
import { ChevronRightIcon } from "@/components/icons";

export function FaqView({ items }: { items: FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="space-y-3">
      {items.map((item, index) => {
        const open = openIndex === index;
        return (
          <div key={item.question} className="rounded-xl border border-card-light-border">
            <button
              type="button"
              onClick={() => setOpenIndex(open ? null : index)}
              className="flex w-full items-center justify-between gap-3 p-4 text-left"
              aria-expanded={open}
            >
              <span className="text-sm font-semibold">{item.question}</span>
              <ChevronRightIcon className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-90" : ""}`} />
            </button>
            {open && <p className="px-4 pb-4 text-sm text-card-light-muted">{item.answer}</p>}
          </div>
        );
      })}
    </div>
  );
}
