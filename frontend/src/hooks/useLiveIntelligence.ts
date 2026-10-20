
import { useEffect, useState } from "react";

export interface LiveArticle {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  topic_id: string;
  matching_topics: string[];
  published_at: string;
  collected_at: string;
  relevance_score: number;
}

interface WebSocketMessage {
  type: string;
  data: LiveArticle;
}

const MAX_ARTICLES = 100;

function mergeArticles(
  current: LiveArticle[],
  incoming: LiveArticle[]
): LiveArticle[] {
  const seen = new Set<string>();
  const merged: LiveArticle[] = [];

  for (const article of [...current, ...incoming]) {
    if (!article.id || seen.has(article.id)) continue;

    seen.add(article.id);
    merged.push(article);
  }

  return merged.slice(0, MAX_ARTICLES);
}

export function useLiveIntelligence() {
  const [articles, setArticles] = useState<LiveArticle[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    // 1. Load saved intelligence history
    async function loadHistory() {
      try {
        const response = await fetch(
          "/api/intelligence?limit=100"
        );

        if (!response.ok) {
          throw new Error(
            `History API returned ${response.status}`
          );
        }

        const history: LiveArticle[] = await response.json();

        if (!stopped && Array.isArray(history)) {
          setArticles((previous) =>
            mergeArticles(previous, history)
          );
        }
      } catch (error) {
        if (!stopped) {
          console.error(
            "Failed to load intelligence history",
            error
          );
        }
      }
    }

    // 2. Connect to live Kafka WebSocket bridge
    function connect() {
      if (stopped) return;

      const protocol =
        window.location.protocol === "https:" ? "wss:" : "ws:";

      const wsUrl =
        import.meta.env.VITE_WS_URL ||
        `${protocol}//${window.location.host}/ws/intelligence`;

      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        if (!stopped) {
          setConnected(true);
        }
      };

      socket.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(
            event.data
          );

          if (message.type !== "news_article") return;

          setArticles((previous) =>
            mergeArticles([message.data], previous)
          );
        } catch (error) {
          console.error(
            "Invalid intelligence message",
            error
          );
        }
      };

      socket.onclose = () => {
        if (stopped) return;

        setConnected(false);

        retryTimer = setTimeout(connect, 3000);
      };

      socket.onerror = () => {
        socket?.close();
      };
    }

    // 3. Start both operations
    loadHistory();
    connect();

    return () => {
      stopped = true;
      clearTimeout(retryTimer);
      socket?.close();
    };
  }, []);

  return {
    articles,
    connected,
  };
}
