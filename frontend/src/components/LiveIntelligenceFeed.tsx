
import { useLiveIntelligence } from "../hooks/useLiveIntelligence";

export default function LiveIntelligenceFeed() {
  const { articles, connected } = useLiveIntelligence();

  return (
    <section className="live-intelligence">
      <div className="live-intelligence-header">
        <h3>LIVE INTELLIGENCE</h3>

        <span className={connected ? "live-online" : "live-offline"}>
          {connected ? "● CONNECTED" : "○ DISCONNECTED"}
        </span>
      </div>

      {articles.length === 0 ? (
        <p>Waiting for new intelligence events...</p>
      ) : (
        <div className="live-intelligence-list">
          {articles.map((article) => (
            <article key={article.id} className="live-intelligence-item">
              <div className="live-intelligence-topics">
                {article.matching_topics?.join(" • ")}
              </div>

              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {article.title}
              </a>

              <small>
                {article.source} • {article.published_at}
              </small>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
