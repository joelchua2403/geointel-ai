
import { useEffect, useState } from "react";
import type { StrategicSite } from "../utils/strategicSites";

const API_BASE = "http://localhost:8000";

type Article = {
  id: string;
  title: string;
  category?: string;
  source?: string;
  url?: string;
  published_at?: string;
  summary?: string;
};

type Briefing = {
  executive_summary: string;
  key_developments: {
    description: string;
    source_ids: string[];
  }[];
  potential_implications: string[];
  limitations: string;
};

type Props = {
  site: StrategicSite;
  onClose: () => void;
};

export default function StrategicSiteIntelPanel({
  site,
  onClose,
}: Props) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setArticles([]);
    setBriefing(null);
    setError(null);
  }, [site.id]);

  async function analyzeSite() {
    setLoading(true);
    setError(null);
    setArticles([]);
    setBriefing(null);

    try {
      const params = new URLSearchParams({
        query: site.name,
      });

      const newsResponse = await fetch(
        `${API_BASE}/api/articles?${params.toString()}`
      );

      if (!newsResponse.ok) {
        throw new Error("Failed to retrieve news articles");
      }

      const newsData = await newsResponse.json();

      // Supports an array response or { articles: [...] }.
      const fetchedArticles: Article[] = Array.isArray(newsData)
        ? newsData
        : newsData.articles ?? [];

        console.log("Strategic site:", site.name);
console.log("Guardian articles:", fetchedArticles);

      setArticles(fetchedArticles);

      if (fetchedArticles.length === 0) {
        return;
      }

      const briefingResponse = await fetch(
        `${API_BASE}/api/briefing`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
         body: JSON.stringify({
  articles: fetchedArticles.slice(0, 5),
}),
        }
      );

      if (!briefingResponse.ok) {
        throw new Error("Failed to generate AI briefing");
      }

      const briefingData: Briefing =
        await briefingResponse.json();

      setBriefing(briefingData);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <aside className="site-intel-panel">
      <div className="site-intel-header">
        <div>
          <span className="site-intel-label">
            STRATEGIC SITE INTELLIGENCE
          </span>
          <h2>{site.name}</h2>
          <p>{site.category}</p>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close intelligence panel"
        >
          ✕
        </button>
      </div>

      <div className="site-intel-section">
        <h3>Site Overview</h3>
        <p>
          {site.description || "No description available."}
        </p>

        <div className="site-intel-coordinates">
          <span>Latitude: {site.lat.toFixed(5)}</span>
          <span>Longitude: {site.lng.toFixed(5)}</span>
        </div>
      </div>

      <div className="site-intel-section">
        <h3>AI Intelligence Analysis</h3>

        <button
          type="button"
          className="site-intel-analyze"
          onClick={analyzeSite}
          disabled={loading}
        >
          {loading ? "Analyzing..." : "Analyze Site"}
        </button>

        {error && (
          <p role="alert" style={{ color: "#fca5a5" }}>
            {error}
          </p>
        )}

        {!loading && articles.length === 0 && !error && (
          <p>
            Search public reporting and generate an
            AI-powered intelligence briefing.
          </p>
        )}
      </div>

      {articles.length > 0 && (
        <div className="site-intel-section">
          <h3>Related News ({articles.length})</h3>

          {articles.map((article) => (
            <div
              key={article.id}
              style={{
                padding: "10px 0",
                borderBottom: "1px solid #334155",
              }}
            >
              <a
                href={article.url || "#"}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: "#c4b5fd",
                  fontSize: 12,
                  lineHeight: 1.5,
                }}
              >
                {article.title}
              </a>

              <p style={{ fontSize: 11 }}>
                {article.source || "Unknown source"}
              </p>
            </div>
          ))}
        </div>
      )}

      
{briefing && (
  <div className="site-intel-section">

    {/* AI EXECUTIVE SUMMARY */}
    <div className="site-ai-summary">
      <div className="site-ai-summary-header">
        <span className="site-ai-indicator" />
        <span>AI EXECUTIVE SUMMARY</span>
        <span className="site-ai-model">OLLAMA</span>
      </div>

      <p className="site-ai-summary-text">
        {briefing.executive_summary ||
          "No executive summary was generated."}
      </p>

      <div className="site-ai-summary-footer">
        AI-generated from retrieved public reporting.
        Verify important claims against the original sources.
      </div>
    </div>

    {/* KEY DEVELOPMENTS */}
    <div className="site-ai-section">
      <h3>Key Developments</h3>

      {briefing.key_developments?.length ? (
        briefing.key_developments.map((item, index) => (
          <div className="site-ai-development" key={index}>
            <span className="site-ai-number">
              {String(index + 1).padStart(2, "0")}
            </span>
            <p>{item.description}</p>
          </div>
        ))
      ) : (
        <p>No key developments identified.</p>
      )}
    </div>

    {/* POTENTIAL IMPLICATIONS */}
    <div className="site-ai-section">
      <h3>Potential Implications</h3>

      {briefing.potential_implications?.length ? (
        briefing.potential_implications.map((item, index) => (
          <p key={index} className="site-ai-implication">
            • {item}
          </p>
        ))
      ) : (
        <p>No implications generated.</p>
      )}
    </div>

    {/* LIMITATIONS */}
    <div className="site-ai-section">
      <h3>Analysis Limitations</h3>
      <p className="site-ai-limitations">
        {briefing.limitations ||
          "This assessment is limited to the retrieved articles."}
      </p>
    </div>

  </div>
)}

    </aside>
  );
}
