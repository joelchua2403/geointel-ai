import logging
import os
from typing import Any

import requests
from mcp.server.fastmcp import FastMCP
import sys

mcp = FastMCP("GeoIntel AI")
logger = logging.getLogger(__name__)
API_URL = os.getenv("GEOINTEL_API_URL", "http://127.0.0.1:8000").rstrip("/")


def _extract_articles(data: Any) -> list[dict]:
    if isinstance(data, list):
        return [item for item in data if isinstance(item, dict)]
    if isinstance(data, dict):
        for key in ("articles", "results", "news"):
            value = data.get(key)
            if isinstance(value, list):
                return [item for item in value if isinstance(item, dict)]
            if isinstance(value, dict):
                for nested_key in ("articles", "results", "items"):
                    nested = value.get(nested_key)
                    if isinstance(nested, list):
                        return [item for item in nested if isinstance(item, dict)]
    return []



@mcp.tool()
def get_recent_news(topic: str = "") -> dict:
    """
    Search recent geopolitical news by topic.

    Args:
        topic: Search topic, e.g. Taiwan Strait, China, Russia.
    """
    topic = topic.strip()

    params = {
        "query": topic,
    }

    response = requests.get(
        f"{API_URL}/api/articles",
        params=params,
        timeout=30,
    )
    response.raise_for_status()

    data = response.json()

    if isinstance(data, list):
        articles = data
    elif isinstance(data, dict):
        articles = data.get("articles", [])
    else:
        articles = []

    if not isinstance(articles, list):
        articles = []

    print(
    f"[MCP] Topic: {topic!r}, "
    f"Retrieved: {len(articles)} articles",
    file=sys.stderr,
    flush=True,
)

    return {
        "topic": topic,
        "articles": articles[:5],
        "count": min(len(articles), 5),
    }



@mcp.tool()
def search_intelligence(question: str) -> dict:
    """Search GeoIntel's indexed intelligence using semantic retrieval."""
    response = requests.post(
        f"{API_URL}/api/rag/query",
        json={"question": question, "limit": 5},
        timeout=240,
    )
    response.raise_for_status()
    return response.json()


if __name__ == "__main__":
    mcp.run(transport="stdio")
