"use client";

import { useEffect, useRef, useState } from "react";
import { FAQ_ITEMS } from "@/lib/faq";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// "Replay app tour" isn't a policy question the LLM can answer from the FAQ/
// Ts & Cs — it's a UI action — so it's handled by onReplayTour directly
// rather than being sent to /api/member/help-chat like the other chips.
const QUICK_QUESTIONS = FAQ_ITEMS.map((item) => item.question);

export function HelpChatView({ onReplayTour }: { onReplayTour?: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(overrideText?: string) {
    const trimmed = (overrideText ?? input).trim();
    if (!trimmed || sending) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setInput("");
    setSending(true);
    setError(null);

    try {
      const res = await fetch("/api/member/help-chat", {
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
    <div className="flex h-full min-h-[200px] flex-col gap-3">
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto rounded-xl border border-card-light-border p-4">
        {messages.length === 0 && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-card-light-muted">
              Ask me anything about bookings, credits, or gym policies — I can only answer from what staff have told
              us, so I&apos;ll say if I&apos;m not sure rather than guess.
            </p>
            <div className="flex flex-wrap gap-2">
              {onReplayTour && (
                <button
                  type="button"
                  onClick={onReplayTour}
                  className="rounded-full border border-card-light-border px-3 py-1.5 text-xs font-medium text-card-light-foreground hover:bg-card-light-foreground hover:text-white"
                >
                  Replay app tour
                </button>
              )}
              {QUICK_QUESTIONS.map((question) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => sendMessage(question)}
                  disabled={sending}
                  className="rounded-full border border-card-light-border px-3 py-1.5 text-xs font-medium text-card-light-foreground hover:bg-card-light-foreground hover:text-white disabled:opacity-50"
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
              m.role === "user" ? "ml-auto bg-accent text-accent-foreground" : "bg-gray-100 text-card-light-foreground"
            }`}
          >
            {m.content}
          </div>
        ))}
        {sending && <p className="text-sm text-card-light-muted">Thinking…</p>}
        <div ref={bottomRef} />
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage();
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a question…"
          maxLength={500}
          className="min-w-0 flex-1 rounded-lg border border-card-light-border px-3 py-2 text-sm text-card-light-foreground placeholder:text-card-light-muted"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="shrink-0 rounded-lg bg-card-light-foreground px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
