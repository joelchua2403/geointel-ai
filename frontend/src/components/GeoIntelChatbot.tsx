import { useEffect, useRef, useState, type FormEvent } from "react";
import "./GeoIntelChatbot.css";

type ChatMessage = { role: "user" | "assistant"; content: string };
type ChatResponse = { answer: string; session_id: string };

export default function GeoIntelChatbot({ apiBaseUrl = "http://localhost:8000" }: { apiBaseUrl?: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const sessionId = useRef(crypto.randomUUID());
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading, open]);
  useEffect(() => () => abortRef.current?.abort(), []);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || loading) return;
    setDraft("");
    setError("");
    setMessages(prev => [...prev, { role: "user", content: message }]);
    setLoading(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const response = await fetch(`${apiBaseUrl.replace(/\/$/, "")}/api/agent/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId.current, message }),
        signal: controller.signal,
      });
      if (!response.ok) {
        let detail = `HTTP ${response.status}`;
        try { const body = await response.json(); detail = body.detail ?? detail; } catch { /* non-JSON error */ }
        throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
      }
      const data: ChatResponse = await response.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.answer }]);
    } catch (err) {
      if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Unable to contact the AI agent.");
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }

  return (
    <div className="geointel-chat-root">
      {open && (
        <section className="geointel-chat-panel" role="dialog" aria-label="GeoIntel AI assistant">
          <header className="geointel-chat-header">
            <div><strong>✦ GEOINTEL AI</strong><small>Intelligence assistant · Llama 3.2 1B</small></div>
            <button type="button" aria-label="Close chatbot" onClick={() => setOpen(false)}>×</button>
          </header>
          <div className="geointel-chat-messages" aria-live="polite">
            {messages.length === 0 && (
              <div className="geointel-chat-welcome">
                <span>✦</span>
                <strong>Ask about global developments</strong>
                <p>Search the indexed geopolitical news and intelligence sources.</p>
                <button type="button" onClick={() => setDraft("What are the latest US–China developments?")}>Try: US–China developments</button>
              </div>
            )}
            {messages.map((item, index) => (
              <div key={index} className={`geointel-chat-bubble ${item.role}`}>{item.content}</div>
            ))}
            {loading && <div className="geointel-chat-bubble assistant">Searching intelligence…</div>}
            {error && <div className="geointel-chat-error" role="alert">{error}</div>}
            <div ref={bottomRef} />
          </div>
          <form className="geointel-chat-form" onSubmit={sendMessage}>
            <input aria-label="Message GeoIntel AI" value={draft} onChange={e => setDraft(e.target.value)} placeholder="Ask GeoIntel AI…" disabled={loading} maxLength={2000} />
            <button type="submit" disabled={loading || !draft.trim()} aria-label="Send message">➤</button>
          </form>
          <div className="geointel-chat-disclaimer">AI responses may be inaccurate. Verify source claims.</div>
        </section>
      )}
      <button type="button" className="geointel-chat-fab" aria-label={open ? "Close AI assistant" : "Open AI assistant"} aria-expanded={open} onClick={() => setOpen(prev => !prev)}>
        {open ? "×" : "✦"}<span>{open ? "Close" : "Ask AI"}</span>
      </button>
    </div>
  );
}
