"use client";

import { useEffect, useRef, useState } from "react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function HelpChatView() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    const trimmed = input.trim();
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
          <p className="text-sm text-card-light-muted">
            Ask me anything about bookings, credits, or gym policies — I can only answer from what staff have told
            us, so I&apos;ll say if I&apos;m not sure rather than guess.
          </p>
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
          className="min-w-0 flex-1 rounded-lg border border-card-light-border px-3 py-2 text-sm"
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
