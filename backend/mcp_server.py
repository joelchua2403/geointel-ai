
import os
import requests

from mcp.server.fastmcp import FastMCP

mcp = FastMCP("GeoIntel AI")

API_URL = os.getenv(
    "GEOINTEL_API_URL",
    "http://127.0.0.1:8000"
)


@mcp.tool()
def get_recent_news(topic: str = "") -> dict:
    """
    Retrieve recent geopolitical news articles.

    Args:
        topic: Optional topic such as China, Taiwan, or Russia.
    """
    response = requests.get(
        f"{API_URL}/api/articles",
        timeout=30
    )
    response.raise_for_status()

    data = response.json()

    articles = (
        data if isinstance(data, list)
        else data.get("articles", [])
    )

    if topic.strip():
        keywords = topic.lower().split()

        articles = [
            article
            for article in articles
            if any(
                keyword in (
                    str(article.get("title") or "")
                    + " "
                    + str(article.get("summary") or "")
                ).lower()
                for keyword in keywords
            )
        ]

    return {
        "topic": topic,
        "articles": articles[:5],
        "count": min(len(articles), 5)
    }


@mcp.tool()
def search_intelligence(question: str) -> dict:
    """
    Search GeoIntel's indexed geopolitical intelligence
    using semantic retrieval and RAG.

    Args:
        question: Natural-language intelligence question.
    """
    response = requests.post(
        f"{API_URL}/api/rag/query",
        json={
            "question": question,
            "limit": 5
        },
        timeout=240
    )
    response.raise_for_status()

    return response.json()


if __name__ == "__main__":
    mcp.run(transport="stdio")
