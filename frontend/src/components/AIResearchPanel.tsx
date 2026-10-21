import { useState, type FormEvent } from "react";
import { BrainCircuit, Search, Loader2, ExternalLink, BookOpen, AlertTriangle, Database, Sparkles } from "lucide-react";
import "./AIResearchPanel.css";

interface ResearchSource {
  id: string;
  reference: string;
  title?: string;
  published_at?: string;
  url?: string;
  distance?: number;
}

interface ResearchResponse {
  answer: string;
  sources: ResearchSource[];
  retrieved_sources?: ResearchSource[];
  limitations: string;
}

const suggestions = [
  "What are the latest developments in the South China Sea?",
  "What geopolitical tensions involve China?",
  "What are the major regional security risks?",
];

export default function AIResearchPanel() {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<ResearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = question.trim();
    if (trimmed.length < 5 || loading) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/rag/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed, limit: 5 }),
      });
      if (!response.ok) throw new Error(`Research request failed (${response.status})`);
      const data: ResearchResponse = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Research unavailable");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="research-panel" aria-label="AI Research Assistant">
      <header className="research-header">
        <div className="research-heading">
          <BrainCircuit size={17} aria-hidden="true" />
          <div>
            <h2>AI RESEARCH ASSISTANT</h2>
            <p>Ask questions grounded in indexed geopolitical intelligence</p>
          </div>
        </div>
        <span className="research-model">RAG · LOCAL AI</span>
      </header>

      <div className="research-body">
        <form onSubmit={handleSubmit} className="research-form">
          <label htmlFor="research-question" className="research-label">
            <Search size={13} aria-hidden="true" /> RESEARCH QUERY
          </label>
          <textarea
            id="research-question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="What are the latest developments in the South China Sea?"
          />
          <div className="research-form-footer">
            <span className="research-hint"><Database size={13} aria-hidden="true" /> Indexed intelligence</span>
            <button className="research-submit" type="submit" disabled={loading || question.trim().length < 5}>
              {loading ? <Loader2 size={14} className="research-spin" aria-hidden="true" /> : <Sparkles size={14} aria-hidden="true" />}
              {loading ? "ANALYSING..." : "GENERATE ANALYSIS"}
            </button>
          </div>
        </form>

        {!result && !loading && (
          <div className="research-suggestions">
            <h3>SUGGESTED QUERIES</h3>
            <div className="research-suggestion-list">
              {suggestions.map((suggestion) => (
                <button key={suggestion} type="button" onClick={() => setQuestion(suggestion)}>{suggestion}</button>
              ))}
            </div>
          </div>
        )}

        {loading && <div className="research-notice" role="status"><Loader2 className="research-spin" size={17} /> Retrieving articles and generating assessment…</div>}
        {error && <div className="research-notice research-error" role="alert"><AlertTriangle size={16} /> {error}</div>}

        {result && (
          <div className="research-results">
            <section className="research-assessment">
              <h3><Sparkles size={14} aria-hidden="true" /> INTELLIGENCE ASSESSMENT</h3>
              <p>{result.answer}</p>
            </section>
            <SourceSection title="CITED SOURCES" sources={result.sources} emptyMessage="No explicit citations were generated." />
            {result.retrieved_sources && (
              <SourceSection title="RETRIEVED INTELLIGENCE" sources={result.retrieved_sources} description="Retrieved for context; not necessarily cited or verified as supporting the answer." />
            )}
            {result.limitations && (
              <section className="research-limitations">
                <h3><AlertTriangle size={14} aria-hidden="true" /> ASSESSMENT LIMITATIONS</h3>
                <p>{result.limitations}</p>
              </section>
            )}
          </div>
        )}
      </div>
      <footer className="research-footer"><span>GEOINTEL AI / RESEARCH MODULE</span><span>Verify critical findings against original reporting</span></footer>
    </section>
  );
}

function SourceSection({ title, sources, description, emptyMessage }: {
  title: string;
  sources: ResearchSource[];
  description?: string;
  emptyMessage?: string;
}) {
  return (
    <section className="research-source-section">
      <div className="research-source-heading"><h3><BookOpen size={14} aria-hidden="true" /> {title}</h3><span>{sources.length}</span></div>
      {description && <p className="research-source-description">{description}</p>}
      {sources.length === 0 && <p className="research-empty">{emptyMessage || "No articles found."}</p>}
      <div className="research-source-list">
        {sources.map((source) => (
          <article className="research-source" key={`${source.reference}-${source.id}`}>
            <span className="research-source-ref">{source.reference}</span>
            <div className="research-source-details">
              {source.url ? (
                <a href={source.url} target="_blank" rel="noopener noreferrer">{source.title || "Untitled article"} <ExternalLink size={12} aria-hidden="true" /></a>
              ) : <strong>{source.title || "Untitled article"}</strong>}
              {source.published_at && <small>{source.published_at}</small>}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
