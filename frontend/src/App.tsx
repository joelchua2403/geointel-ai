
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import WorldMap from "./components/WorldMap";
import RegionalIntelPanel from "./components/RegionalIntelPanel";
import StrategicSitesManager from "./components/StrategicSitesManager";

import {
  findArticleLocation,
  findArticleLocations,
} from "./utils/locations";
import type { GeoLocation } from "./utils/locations";

import { useStrategicSites } from "./utils/strategicSites";
import StrategicSiteIntelPanel from "./components/StrategicSiteIntelPanel.tsx";
import type { StrategicSite } from "./utils/strategicSites";
import LiveIntelligenceFeed from "./components/LiveIntelligenceFeed";
import "./App.css";
import AIResearchPanel from "./components/AIResearchPanel.tsx";
import GeoIntelChatbot from "./components/GeoIntelChatbot";

const API = import.meta.env.VITE_API_URL || "";

// ==========================================
// TYPES
// ==========================================

type Article = {
  id: string;
  title: string;
  category: string;
  country?: string;
  summary?: string;
  source: string;
  url: string;
  published_at: string;
};

type Development = {
  description: string;
  source_ids: string[];
};

type IntelligenceBriefing = {
  executive_summary: string;
  key_developments: Development[];
  potential_implications: string[];
  limitations: string;
};

type Section =
  | "overview"
  | "conflicts"
  | "business"
  | "technology"
  | "environment";

type Coordinates = {
  lat: number;
  lng: number;
};

const sections: {
  id: Section;
  label: string;
  category: string;
}[] = [
  { id: "overview", label: "OVERVIEW", category: "all" },
  { id: "conflicts", label: "WORLD", category: "world" },
  { id: "business", label: "BUSINESS", category: "business" },
  { id: "technology", label: "TECHNOLOGY", category: "technology" },
  { id: "environment", label: "ENVIRONMENT", category: "environment" },
];

function timeLabel(value?: string) {
  if (!value) return "";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

// ==========================================
// APP
// ==========================================

export default function App() {
  // Navigation and news
  const [section, setSection] = useState<Section>("overview");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  // Map selection
  const [selectedLocation, setSelectedLocation] =
    useState<GeoLocation | null>(null);

  const [showNewsMarkers, setShowNewsMarkers] = useState(true);
  const [showStrategicMarkers, setShowStrategicMarkers] = useState(false);
  const [selectedStrategicSite, setSelectedStrategicSite] =
  useState<StrategicSite | null>(null);

  // Strategic sites
 const {
  sites,
  setSites,
  loadingSites,
  sitesError,
} = useStrategicSites();
  const [showSitesManager, setShowSitesManager] = useState(false);

  // NEW: Map coordinate picker
  const [pickingLocation, setPickingLocation] = useState(false);
  const [pickedCoordinates, setPickedCoordinates] =
    useState<Coordinates | null>(null);

  // AI briefing
  const [briefing, setBriefing] =
    useState<IntelligenceBriefing | null>(null);

  const [briefingArticles, setBriefingArticles] = useState<Article[]>([]);
  const [generating, setGenerating] = useState(false);
  const [briefingError, setBriefingError] = useState<string | null>(null);
  const [showBriefing, setShowBriefing] = useState(true);

  const activeSection =
    sections.find((item) => item.id === section)!;

  const enabledSitesCount = useMemo(
    () => sites.filter((site) => site.enabled).length,
    [sites]
  );

  // ========================================
  // SEARCH DEBOUNCE
  // ========================================

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 400);

    return () => window.clearTimeout(timer);
  }, [query]);

  // ========================================
  // FETCH NEWS
  // ========================================

  useEffect(() => {
    const controller = new AbortController();

    async function loadArticles() {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();

        if (debouncedQuery) {
          params.set("query", debouncedQuery);
        }

        if (activeSection.category !== "all") {
          params.set("category", activeSection.category);
        }

        const response = await fetch(
          `${API}/api/articles?${params.toString()}`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error(`News API returned ${response.status}`);
        }

        const json: unknown = await response.json();

        const rows = Array.isArray(json)
          ? json
          : json && typeof json === "object" && "articles" in json
            ? (json as { articles: unknown }).articles
            : [];

        if (!Array.isArray(rows)) {
          throw new Error("Unexpected articles response");
        }

        if (!controller.signal.aborted) {
          setArticles(rows as Article[]);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load news"
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadArticles();

    return () => controller.abort();
  }, [debouncedQuery, activeSection.category, refreshToken]);

  // ========================================
  // LOCATION FILTERING
  // ========================================

  const visibleArticles = useMemo(() => {
    if (!selectedLocation) return articles;

    return articles.filter((article) =>
      findArticleLocations(article.title).some(
        (location) => location.name === selectedLocation.name
      )
    );
  }, [articles, selectedLocation]);

  const selectLocation = useCallback((location: GeoLocation) => {
    setSelectedLocation({ ...location });
  }, []);

  const clearLocation = useCallback(() => {
    setSelectedLocation(null);
  }, []);

  const mappedCount = useMemo(
    () =>
      articles.filter((article) =>
        findArticleLocation(article.title)
      ).length,
    [articles]
  );

  // ========================================
  // STRATEGIC SITE MAP PICKER
  // ========================================

  const startPickingLocation = useCallback(() => {
    setPickedCoordinates(null);
    setSelectedLocation(null);
    setShowSitesManager(false);
    setPickingLocation(true);
  }, []);

  const handlePickLocation = useCallback(
    (lat: number, lng: number) => {
      setPickedCoordinates({ lat, lng });
      setPickingLocation(false);
      setShowSitesManager(true);
    },
    []
  );

  const cancelPickingLocation = useCallback(() => {
    setPickingLocation(false);
    setShowSitesManager(true);
  }, []);

  const closeSitesManager = useCallback(() => {
    setShowSitesManager(false);
    setPickingLocation(false);
  }, []);

  const consumePickedCoordinates = useCallback(() => {
    setPickedCoordinates(null);
  }, []);

  // ========================================
  // GENERATE AI BRIEFING
  // ========================================

  const generateBriefing = useCallback(async () => {
    const selected = articles.slice(0, 20);

    if (selected.length === 0) return;

    setGenerating(true);
    setBriefingError(null);

    try {
      const response = await fetch(`${API}/api/briefing`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ articles: selected }),
      });

      if (!response.ok) {
        throw new Error(`AI briefing failed (${response.status})`);
      }

      const result =
        (await response.json()) as IntelligenceBriefing;

      setBriefing(result);
      setBriefingArticles(selected);
      setShowBriefing(true);
    } catch (err) {
      setBriefingError(
        err instanceof Error
          ? err.message
          : "AI briefing failed"
      );
    } finally {
      setGenerating(false);
    }
  }, [articles]);

  // ========================================
  // RENDER
  // ========================================

  return (
    <div className="terminal-shell">
      {/* LEFT SIDEBAR */}
      <aside className="rail" aria-label="Main navigation">
        <div className="rail-brand" title="GeoIntel AI">
          ◎
        </div>

        <button
          className="rail-button active"
          title="Global map"
          type="button"
        >
          ◉
        </button>

        <button
          className="rail-button"
          title="Refresh news"
          type="button"
          onClick={() => setRefreshToken((n) => n + 1)}
        >
          ↻
        </button>

        <button
          className="rail-button"
          title="Generate AI briefing"
          type="button"
          onClick={() => void generateBriefing()}
          disabled={generating || loading || articles.length === 0}
        >
          ✧
        </button>

        <button
          className="rail-button"
          title="Toggle AI briefing"
          type="button"
          onClick={() => setShowBriefing((value) => !value)}
        >
          ▤
        </button>

        <button
          className="rail-button"
          title="Manage strategic sites"
          type="button"
          onClick={() => setShowSitesManager(true)}
        >
          ⚙
        </button>

        <div className="rail-spacer" />
        <div className="rail-bottom">⌘</div>
      </aside>

      <div className="terminal-main">
        {/* TOP NAVIGATION */}
        <header className="topbar">
          <div className="brand">
            <strong>
              GEOINTEL<span> AI</span>
            </strong>
            <small>GLOBAL INTELLIGENCE TERMINAL</small>
          </div>

          <nav className="topnav">
            {sections.map((item) => (
              <button
                key={item.id}
                type="button"
                className={
                  section === item.id
                    ? "nav-tab selected"
                    : "nav-tab"
                }
                onClick={() => setSection(item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="topbar-status">
            <span className="status-dot" />
            {loading
              ? "SYNCING"
              : error
                ? "OFFLINE"
                : "FEED ACTIVE"}
          </div>
        </header>

        {/* TICKER */}
        <div className="ticker">
          <span className="ticker-label">INTEL</span>
          <span>● GUARDIAN NEWS FEED</span>
          <span>◆ {articles.length} ARTICLES</span>
          <span>◉ {mappedCount} GEO-MATCHED</span>
          <span>◆ {enabledSitesCount} CUSTOM SITES</span>
          <span>✧ LOCAL AI · llama3.2:1b</span>
          <span>◆ HEADLINE-BASED ANALYSIS</span>
        </div>

        {/* MAIN WORKSPACE */}
        <main className="workspace">
          {/* MAP */}
          <section className="map-pane">
            <WorldMap
              articles={showNewsMarkers ? articles : []}
              selectedLocation={selectedLocation}
              onSelectLocation={
                pickingLocation
                  ? () => {}
                  : selectLocation
              }
              showStrategicMarkers={showStrategicMarkers}
              strategicSites={sites}
              pickingLocation={pickingLocation}
              onPickLocation={handlePickLocation}
              onSelectStrategicSite={setSelectedStrategicSite}
            />

            {selectedStrategicSite && (
<StrategicSiteIntelPanel
  site={selectedStrategicSite}
  onClose={() => setSelectedStrategicSite(null)}
/>
)}

            {/* MAP PICKING BANNER */}
            {pickingLocation && (
              <div className="map-pick-banner">
                ◎ Click anywhere on the map to select coordinates

                <button
                  type="button"
                  onClick={cancelPickingLocation}
                  style={{
                    marginLeft: 14,
                    background: "transparent",
                    border: 0,
                    color: "#fca5a5",
                    fontWeight: 700,
                  }}
                >
                  CANCEL
                </button>
              </div>
            )}

            {/* REGIONAL INTELLIGENCE PANEL */}
            {!pickingLocation && selectedLocation && (
              <RegionalIntelPanel
                key={selectedLocation.name}
                location={selectedLocation}
                articles={articles}
                onClose={clearLocation}
              />
            )}

            {/* MAP TITLE */}
            <div className="map-title">
              <span className="eyebrow">
                GEOSPATIAL OVERVIEW
              </span>
              <strong>GLOBAL MONITOR</strong>
            </div>

            {/* MAP LAYERS */}
            <div className="layers-panel">
              <div className="panel-heading">
                <span>MAP LAYERS</span>
                <span>2 OPTIONS</span>
              </div>

              <label>
                <input
                  type="checkbox"
                  checked={showNewsMarkers}
                  onChange={(event) =>
                    setShowNewsMarkers(event.target.checked)
                  }
                />
                <span className="layer-symbol">●</span>
                News locations
                <em>{showNewsMarkers ? "ON" : "OFF"}</em>
              </label>

              <label>
                <input
                  type="checkbox"
                  checked={showStrategicMarkers}
                  onChange={(event) =>
                    setShowStrategicMarkers(event.target.checked)
                  }
                />
                <span className="layer-symbol diamond">◆</span>
                Strategic sites
                <em>{showStrategicMarkers ? "ON" : "OFF"}</em>
              </label>

              {loadingSites && (
  <p className="layers-note">Loading strategic sites...</p>
)}

{sitesError && (
  <p className="layers-note" role="alert">
    Database error: {sitesError}
  </p>
)}

              {/* MANAGE STRATEGIC SITES BUTTON */}
              <button
                type="button"
                className="manage-sites-button"
                onClick={() => setShowSitesManager(true)}
              >
                <span className="manage-sites-icon">⚙</span>

                <span className="manage-sites-label">
                  <strong>Manage sites</strong>
                  <small>
                    {sites.length} configured locations
                  </small>
                </span>

                <span className="manage-sites-arrow">↗</span>
              </button>

              <p className="layers-note">
                Strategic markers are reference locations.
                News markers indicate headline mentions.
              </p>
            </div>

            {/* MAP STATUS */}
            <div className="map-count">
              <span className="status-dot" />
              {" "}
              {mappedCount} ARTICLES WITH LOCATIONS
              {selectedLocation
                ? ` · FOCUSED: ${selectedLocation.name}`
                : ""}
            </div>
          </section>

          {/* NEWS FEED */}
          <aside className="feed-pane">
            {/* LIVE KAFKA INTELLIGENCE — above the existing Guardian feed */}
            <div className="kafka-feed-section">
              <LiveIntelligenceFeed />
            </div>

            <div className="feed-heading">
              <span>
                {selectedLocation
                  ? `INTEL FEED · ${selectedLocation.name.toUpperCase()}`
                  : "INTEL FEED"}
              </span>

              <span className="live-chip">
                {loading
                  ? "LOADING"
                  : `${visibleArticles.length} ARTICLES`}
              </span>
            </div>

            {selectedLocation && (
              <div className="location-filter">
                <span>
                  ⌖ Showing headlines mentioning{" "}
                  <strong>{selectedLocation.name}</strong>
                </span>

                <button
                  type="button"
                  onClick={clearLocation}
                >
                  CLEAR SELECTION ×
                </button>
              </div>
            )}

            <div className="feed-search">
              <span>⌕</span>

              <input
                value={query}
                onChange={(event) =>
                  setQuery(event.target.value)
                }
                placeholder="Search global intelligence..."
              />

              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                >
                  ×
                </button>
              )}
            </div>

            <div className="feed-list">
              {error && (
                <p className="feed-message error">
                  {error}{" "}
                  <button
                    type="button"
                    onClick={() =>
                      setRefreshToken((n) => n + 1)
                    }
                  >
                    Retry
                  </button>
                </p>
              )}

              {!error &&
                !loading &&
                visibleArticles.length === 0 && (
                  <p className="feed-message">
                    No matching articles found.
                  </p>
                )}

              {visibleArticles.map((article) => {
                const location = findArticleLocation(
                  article.title
                );

                return (
                  <article
                    className="feed-item"
                    key={article.id}
                  >
                    <div className="feed-meta">
                      <span className="feed-tag">
                        {article.category || "WORLD"}
                      </span>
                      <span>
                        {timeLabel(article.published_at)}
                      </span>
                    </div>

                    <button
                      type="button"
                      className="headline-button"
                      onClick={() =>
                        location && selectLocation(location)
                      }
                      title={
                        location
                          ? `Focus map on ${location.name}`
                          : "No location detected"
                      }
                    >
                      {article.title}
                    </button>

                    <div className="feed-footer">
                      <span>
                        {location
                          ? `⌖ ${location.name}`
                          : article.source ||
                            "The Guardian"}
                      </span>

                      <a
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        READ ↗
                      </a>
                    </div>
                  </article>
                );
              })}
            </div>
          </aside>
        </main>

        {/* AI BRIEFING */}
        {showBriefing && (
          <section className="bottom-panels">
            <div className="briefing-main">
              <div className="bottom-heading">
                <span>
                  ✧ AI INTELLIGENCE BRIEFING
                </span>

                <button
                  type="button"
                  onClick={() =>
                    void generateBriefing()
                  }
                  disabled={
                    generating ||
                    loading ||
                    articles.length === 0
                  }
                >
                  {generating
                    ? "ANALYZING..."
                    : "GENERATE BRIEFING ↗"}
                </button>
              </div>

              {briefingError && (
                <p className="error">
                  {briefingError}
                </p>
              )}

              {!briefing && !generating && (
                <p className="muted">
                  Generate a sourced intelligence
                  briefing using your local AI model.
                </p>
              )}

              {generating && (
                <p className="muted">
                  Analyzing headlines with llama3.2:1b...
                </p>
              )}

              {briefing && (
                <div className="briefing-content">
                  <p>
                    {briefing.executive_summary}
                  </p>

                  <div className="briefing-subheading">
                    KEY DEVELOPMENTS
                  </div>

                  <ul>
                    {briefing.key_developments.map(
                      (development, index) => (
                        <li key={index}>
                          {development.description}

                          <div className="briefing-citations">
                            {development.source_ids.map(
                              (id) => {
                                const source =
                                  briefingArticles.find(
                                    (article) =>
                                      article.id === id
                                  );

                                return source ? (
                                  <a
                                    key={id}
                                    href={source.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    SOURCE ↗{" "}
                                    {source.title}
                                  </a>
                                ) : null;
                              }
                            )}
                          </div>
                        </li>
                      )
                    )}
                  </ul>
                </div>
              )}
            </div>

            <div className="briefing-side">
              <div className="bottom-heading">
                POTENTIAL IMPLICATIONS
              </div>

              {briefing ? (
                <ul>
                  {briefing.potential_implications.map(
                    (item, index) => (
                      <li key={index}>{item}</li>
                    )
                  )}
                </ul>
              ) : (
                <p className="muted">
                  Awaiting analysis
                </p>
              )}
            </div>

            <div className="briefing-side">
              <div className="bottom-heading">
                SOURCE &amp; LIMITATIONS
              </div>

              <p className="muted">
                {briefing?.limitations ||
                  "The Guardian headlines · Local Ollama inference"}
              </p>

              <p className="muted">
                Geographic markers represent approximate
                headline matches, not verified
                incident locations.
              </p>
            </div>
          </section>
        )}

        {/* AI Research Assistant */}
<AIResearchPanel />

{/* Floating AI Chatbot */}
<GeoIntelChatbot apiBaseUrl={API} />

        {/* STATUS BAR */}
        <footer className="statusbar">
          <span>SYS: NOMINAL</span>
          <span>NEWS: THE GUARDIAN</span>
          <span>MODEL: llama3.2:1b LOCAL</span>
          <span className="statusbar-right">
            GEOINTEL AI / DEVELOPMENT BUILD
          </span>
        </footer>
      </div>

      {/* STRATEGIC SITES MANAGER */}
      {showSitesManager && (
        <StrategicSitesManager
          sites={sites}
          onChange={setSites}
          onClose={closeSitesManager}
          onPickOnMap={startPickingLocation}
          pickedCoordinates={pickedCoordinates}
          onCoordinatesConsumed={consumePickedCoordinates}
        />
      )}
    </div>
  );
}
