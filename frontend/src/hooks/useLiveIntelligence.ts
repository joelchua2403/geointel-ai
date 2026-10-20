
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

export function useLiveIntelligence() {
  const [articles, setArticles] = useState<LiveArticle[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    function connect() {
     const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";

const wsUrl =
  import.meta.env.VITE_WS_URL ||
  `${protocol}//${window.location.host}/ws/intelligence`;

socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        setConnected(true);
      };

      socket.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(
            event.data
          );

          if (message.type !== "news_article") return;

          setArticles((previous) => {
            const withoutDuplicate = previous.filter(
              (article) => article.id !== message.data.id
            );

            return [
              message.data,
              ...withoutDuplicate,
            ].slice(0, 100);
          });
        } catch (error) {
          console.error(
            "Invalid intelligence message",
            error
          );
        }
      };

      socket.onclose = () => {
        setConnected(false);

        if (!stopped) {
          retryTimer = setTimeout(connect, 3000);
        }
      };

      socket.onerror = () => {
        socket?.close();
      };
    }

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
