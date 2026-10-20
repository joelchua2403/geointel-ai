
import { useEffect, useMemo, useState } from "react";
import type { GeoLocation } from "../utils/locations";
import { findArticleLocations } from "../utils/locations";

const API = "http://localhost:8000";

interface Article {
  id: string;
  title: string;
  category: string;
  country?: string;
  summary?: string;
  source: string;
  url: string;
  published_at: string;
}

interface Development {
  description: string;
  source_ids: string[];
}

interface Briefing {
  executive_summary: string;
  key_developments: Development[];
  potential_implications: string[];
  limitations: string;
}

interface Props {
  location: GeoLocation;
  articles: Article[];
  onClose: () => void;
}

export default function RegionalIntelPanel({
  location,
  articles,
  onClose,
}: Props) {
  const regionalArticles = useMemo(
    () =>
      articles.filter((article) =>
        findArticleLocations(article.title).some(
          (match) => match.name === location.name
        )
      ),
    [articles, location.name]
  );

  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [briefingSources, setBriefingSources] = useState<Article[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Clear stale analysis when the selected region changes.
  useEffect(() => {
    setBriefing(null);
    setBriefingSources([]);
    setError(null);
  }, [location.name, articles]);

  async function generateRegionalBriefing() {
    const selected = regionalArticles.slice(0, 20);
    if (!selected.length) return;

    setGenerating(true);
    setError(null);

    try {
      const response = await fetch(`${API}/api/briefing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articles: selected }),
      });

      if (!response.ok) {
        throw new Error(`Briefing failed (${response.status})`);
      }

      const result = (await response.json()) as Briefing;

      setBriefing(result);
      setBriefingSources(selected);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to generate briefing"
      );
    } finally {
      setGenerating(false);
    }
  }

  return (
    <aside className="regional-intel-panel" aria-label="Regional intelligence">
      <div className="regional-panel-header">
        <div>
          <span className="regional-eyebrow">REGIONAL INTELLIGENCE</span>
          <h2>{location.name}</h2>
        </div>

        <button
          className="regional-close"
          onClick={onClose}
          aria-label="Close regional intelligence panel"
        >
          ×
        </button>
      </div>

      <div className="regional-panel-content">
        <div className="regional-stat-row">
          <div>
            <span>RELATED ARTICLES</span>
            <strong>{regionalArticles.length}</strong>
          </div>
          <div>
            <span>COORDINATES</span>
            <strong>
              {location.lat.toFixed(2)}, {location.lng.toFixed(2)}
            </strong>
          </div>
        </div>

        <div className="regional-section-heading">
          <span>RELATED DEVELOPMENTS</span>
          <span>THE GUARDIAN</span>
        </div>

        <div className="regional-articles">
          {regionalArticles.length === 0 && (
            <p className="regional-muted">
              No current headlines mention this location.
            </p>
          )}

          {regionalArticles.slice(0, 8).map((article) => (
            <a
              key={article.id}
              className="regional-article"
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span>{article.category || "WORLD"}</span>
              <strong>{article.title}</strong>
              <small>READ SOURCE ↗</small>
            </a>
          ))}
        </div>

        <div className="regional-section-heading">
          <span>AI REGIONAL ASSESSMENT</span>
          <span>QWEN 2.5</span>
        </div>

        <button
          className="regional-generate"
          disabled={generating || regionalArticles.length === 0}
          onClick={() => void generateRegionalBriefing()}
        >
          {generating ? "ANALYZING REGION..." : "✧ GENERATE REGIONAL BRIEFING"}
        </button>

        {error && <p className="regional-error">{error}</p>}

        {briefing && (
          <div className="regional-analysis">
            <h3>EXECUTIVE SUMMARY</h3>
            <p>{briefing.executive_summary}</p>

            <h3>KEY DEVELOPMENTS</h3>
            <ul>
              {briefing.key_developments.map((item, index) => (
                <li key={index}>
                  {item.description}

                  {item.source_ids.map((id) => {
                    const source = briefingSources.find(
                      (article) => article.id === id
                    );

                    return source ? (
                      <a
                        key={id}
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        SOURCE ↗
                      </a>
                    ) : null;
                  })}
                </li>
              ))}
            </ul>

            <h3>POTENTIAL IMPLICATIONS</h3>
            <ul>
              {briefing.potential_implications.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>

            <h3>LIMITATIONS</h3>
            <p>{briefing.limitations}</p>
          </div>
        )}

        <p className="regional-disclaimer">
          Geographic matching is based on headline mentions, not verified
          incident coordinates. AI assessments may contain errors.
        </p>
      </div>
    </aside>
  );
}
