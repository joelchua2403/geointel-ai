import { useEffect, useRef, useState, type FormEvent } from "react";
import "./GeoIntelChatbot.css";
import { watchReportProgress, type AgentProgress } from "../services/reportProgress";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  type?: "chat" | "report";
  downloadUrl?: string;
};

type ChatResponse = {
  answer: string;
  session_id: string;
};

type IntentResponse =
  | { type: "chat" }
  | { type: "report"; job_id: string; message: string };

type Props = { apiBaseUrl?: string };

const AGENT_ORDER = [
  "research_agent",
  "analysis_agent",
  "verification_agent",
  "report_writer_agent",
  "validate_report_node",
  "pdf_generator_node",
];

const AGENT_LABELS: Record<string, string> = {
  research_agent: "Research Agent",
  analysis_agent: "Analysis Agent",
  verification_agent: "Verification Agent",
  report_writer_agent: "Report Writer",
  validate_report_node: "Report Validation",
  pdf_generator_node: "PDF Generator",
};

/**
 * Resolve an optional API base URL against the current page.
 * Supports "", "/", "/api", "http://localhost:8000", etc.
 * IMPORTANT: new URL(path, "") throws; always provide window.location.origin.
 */
function resolveApiBase(base: string): string {
  const trimmed = base.trim();
  if (!trimmed) return window.location.origin;
  const resolved = new URL(trimmed, window.location.origin);
  if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
    throw new Error("API base URL must use http or https");
  }
  return resolved.href.replace(/\/+$/, "");
}

function apiUrl(base: string, path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}

function resolveDownloadUrl(base: string, value: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error("Report download URL is empty");
  const url = new URL(trimmed, `${base}/`);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Unsupported report download URL");
  }
  return url.href;
}

async function checkResponse(response: Response): Promise<void> {
  if (response.ok) return;
  let detail = `HTTP ${response.status}`;
  try {
    const body: unknown = await response.json();
    if (typeof body === "object" && body !== null && "detail" in body) {
      const value = (body as { detail: unknown }).detail;
      detail = typeof value === "string" ? value : JSON.stringify(value);
    }
  } catch {
    // Non-JSON responses are fine; keep the HTTP status.
  }
  throw new Error(detail);
}

export default function GeoIntelChatbot({ apiBaseUrl }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const [agentProgress, setAgentProgress] = useState<Record<string, AgentProgress>>({});

  const sessionId = useRef(crypto.randomUUID());
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const busyRef = useRef(false);

  // VITE_API_URL is empty in the Docker/Nginx build: use the current origin.
  // A prop overrides the build-time environment variable.
  const configuredBase = apiBaseUrl ?? import.meta.env.VITE_API_URL ?? "";
  const api = resolveApiBase(configuredBase);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, progress, agentProgress, open]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  async function detectIntent(message: string, signal: AbortSignal): Promise<IntentResponse> {
    const conversationContext = messages
      .slice(-8)
      .map((item) => `${item.role}: ${item.content}`)
      .join("\n");

    const response = await fetch(apiUrl(api, "/api/chat/report-intent"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, conversation_context: conversationContext }),
      signal,
    });
    await checkResponse(response);
    const data: IntentResponse = await response.json();
    if (data.type !== "chat" && data.type !== "report") {
      throw new Error("Unexpected response from report-intent endpoint");
    }
    if (data.type === "report" && !data.job_id) {
      throw new Error("Report-intent response is missing job_id");
    }
    return data;
  }

  async function sendNormalChat(message: string, signal: AbortSignal): Promise<void> {
    setProgress("Searching intelligence...");
    const response = await fetch(apiUrl(api, "/api/agent/chat"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId.current, message }),
      signal,
    });
    await checkResponse(response);
    const data: ChatResponse = await response.json();
    setMessages((previous) => [
      ...previous,
      { role: "assistant", content: data.answer, type: "chat" },
    ]);
  }

  async function generateReport(jobId: string, signal: AbortSignal): Promise<void> {
    setProgress("Starting LangGraph workflow...");
    setAgentProgress({});

    // Pass a valid ABSOLUTE base URL to the existing WebSocket helper.
    // This avoids new URL(..., "") errors inside reportProgress.ts.
    const downloadUrl = await watchReportProgress(
      api,
      jobId,
      (event) => {
        if (signal.aborted) return;
        if (event.type === "node_progress" && event.node) {
          const node = event.node;
          const label = event.label ?? AGENT_LABELS[node] ?? node;
          const status = event.status as AgentProgress["status"];
          setAgentProgress((previous) => ({
            ...previous,
            [node]: {
              node,
              label,
              status,
              description: event.description ?? "",
            },
          }));
          if (status === "running") {
            setProgress(`${label}: ${event.description ?? "Processing..."}`);
          } else if (status === "completed") {
            setProgress(`${label} completed`);
          } else if (status === "failed") {
            setProgress(`${label} failed`);
          }
        }
        if (event.type === "job_status") {
          if (event.status === "queued") setProgress("Report queued...");
          if (event.status === "running") setProgress("Generating intelligence report...");
          if (event.status === "completed") setProgress("Intelligence report completed!");
          if (event.status === "failed") setProgress("Report generation failed.");
        }
      },
      signal
    );

    if (signal.aborted) return;
    setMessages((previous) => [
      ...previous,
      {
        role: "assistant",
        content: "Your intelligence report has been generated successfully.",
        type: "report",
        downloadUrl: resolveDownloadUrl(api, downloadUrl),
      },
    ]);
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const message = draft.trim();
    if (!message || busyRef.current) return;
    busyRef.current = true;
    setDraft("");
    setError("");
    setProgress("Understanding your request...");
    setAgentProgress({});
    setMessages((previous) => [...previous, { role: "user", content: message }]);
    setLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const intent = await detectIntent(message, controller.signal);
      if (intent.type === "report") {
        await generateReport(intent.job_id, controller.signal);
      } else {
        await sendNormalChat(message, controller.signal);
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err.message : "Unable to contact the AI agent.");
      }
    } finally {
      busyRef.current = false;
      setLoading(false);
      setProgress("");
      if (abortRef.current === controller) abortRef.current = null;
    }
  }

  function renderAgentProgress() {
    if (Object.keys(agentProgress).length === 0) return null;
    return (
      <div className="geointel-agent-progress">
        {AGENT_ORDER.map((node) => {
          const agent = agentProgress[node];
          if (!agent) return null;
          const icon =
            agent.status === "running" ? "◉" :
            agent.status === "completed" ? "✓" :
            agent.status === "failed" ? "✕" : "○";
          return (
            <div key={node} className={`geointel-agent-row ${agent.status}`}>
              <span className="geointel-agent-icon">{icon}</span>
              <div>
                <strong>{agent.label}</strong>
                {agent.description && <small>{agent.description}</small>}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="geointel-chat-root">
      {open && (
        <section className="geointel-chat-panel" role="dialog" aria-label="GeoIntel AI assistant">
          <header className="geointel-chat-header">
            <div>
              <strong>✦ GEOINTEL AI</strong>
              <small>Intelligence assistant · Qwen 2.5 1.5B</small>
            </div>
            <button type="button" aria-label="Close chatbot" onClick={() => setOpen(false)}>×</button>
          </header>

          <div className="geointel-chat-messages" aria-live="polite">
            {messages.length === 0 && (
              <div className="geointel-chat-welcome">
                <span>✦</span>
                <strong>Ask about global developments</strong>
                <p>Search geopolitical intelligence, analyze global developments, or generate detailed PDF reports.</p>
                <button type="button" onClick={() => setDraft("What are the latest US–China developments?")}>
                  Try: US–China developments
                </button>
                <button type="button" onClick={() => setDraft("Generate a detailed intelligence report on Taiwan Strait developments over the last 7 days")}>
                  Try: Generate intelligence report
                </button>
              </div>
            )}

            {messages.map((item, index) => (
              <div key={index} className={`geointel-chat-bubble ${item.role}`}>
                <div>{item.content}</div>
                {item.type === "report" && item.downloadUrl && (
                  <a className="geointel-report-download" href={item.downloadUrl} target="_blank" rel="noopener noreferrer">
                    📄 Download PDF Report
                  </a>
                )}
              </div>
            ))}

            {loading && (
              <div className="geointel-chat-bubble assistant">
                <div className="geointel-progress-title">
                  <span className="geointel-chat-spinner" />
                  <span>{progress || "Processing..."}</span>
                </div>
                {renderAgentProgress()}
              </div>
            )}

            {error && <div className="geointel-chat-error" role="alert">{error}</div>}
            <div ref={bottomRef} />
          </div>

          <form className="geointel-chat-form" onSubmit={sendMessage}>
            <input
              aria-label="Message GeoIntel AI"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ask GeoIntel AI..."
              disabled={loading}
              maxLength={2000}
            />
            <button type="submit" disabled={loading || !draft.trim()} aria-label="Send message">➤</button>
          </form>
          <div className="geointel-chat-disclaimer">AI responses may be inaccurate. Verify source claims.</div>
        </section>
      )}
      <button
        type="button"
        className="geointel-chat-fab"
        aria-label={open ? "Close AI assistant" : "Open AI assistant"}
        aria-expanded={open}
        onClick={() => setOpen((previous) => !previous)}
      >
        {open ? "×" : "✦"}
        <span>{open ? "Close" : "Ask AI"}</span>
      </button>
    </div>
  );
}
