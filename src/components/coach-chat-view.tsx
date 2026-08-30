"use client";

import { useEffect, useRef, useState } from "react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const QUICK_QUESTIONS = ["Should I train today?", "Is my protein enough?", "Why did my weight change this week?"];

// The coach's system prompt (coach-chat.ts) has the model tag any real
// PubMed citation with "[PMID n]", copied verbatim from the search tool's
// own results — server-side sanitizeCitedPmids() strips any tag that
// wasn't actually returned, so every tag reaching here is real. Rendered
// as a link so a member (or Carl) can independently verify a citation
// with one click rather than trusting the summary on faith.
const PMID_TAG = /\[PMID (\d+)\]/g;

function renderMessageContent(content: string) {
  const parts = content.split(PMID_TAG);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <a
        key={i}
        href={`https://pubmed.ncbi.nlm.nih.gov/${part}/`}
        target="_blank"
        rel="noopener noreferrer"
        className="underline decoration-dotted underline-offset-2"
      >
        [PMID {part}]
      </a>
    ) : (
      part
    ),
  );
}

export function CoachChatView({ initialMessages }: { initialMessages: ChatMessage[] }) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setInput("");
    setSending(true);
    setError(null);

    try {
      const res = await fetch("/api/member/coach-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, history: messages.slice(-6) }),
      });
      const data = await res.json();
      if (data.status !== "ok") {
        setError(data.message ?? "Something went wrong.");
        return;
      }
      setMessages([...nextMessages, { role: "assistant", content: data.reply }]);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    // max-h + the message list's own min-h-0/overflow-y-auto (below) is
    // what actually makes this a scrollable chat pane rather than an
    // ever-growing block — a flex child needs min-h-0 to respect
    // overflow at all (its default min-height:auto otherwise just grows
    // to fit content, defeating overflow-y-auto). Before this fix
    // (2026-08-29 bug) the container had no max-height, so every message
    // ever sent just kept pushing the whole /coach page taller instead
    // of scrolling within its own bounded panel.
    <div className="flex max-h-[70vh] min-h-[60vh] flex-col gap-4">
      {messages.length === 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quick questions</p>
          {QUICK_QUESTIONS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => send(q)}
              className="block w-full rounded-lg bg-accent px-4 py-2.5 text-left text-sm font-semibold text-accent-foreground"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm ${
              m.role === "user" ? "ml-auto bg-accent text-accent-foreground" : "card-glass text-foreground"
            }`}
          >
            {m.role === "assistant" ? renderMessageContent(m.content) : m.content}
          </div>
        ))}
        {sending && <p className="text-sm text-muted-foreground">Thinking…</p>}
        <div ref={bottomRef} />
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask your coach…"
          maxLength={500}
          className="min-w-0 flex-1 rounded-lg border border-card-border bg-card px-3 py-2 text-sm text-foreground"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
