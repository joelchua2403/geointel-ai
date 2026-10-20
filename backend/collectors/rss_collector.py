
import asyncio
import hashlib
import json
import logging
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote_plus

import feedparser
import httpx
from aiokafka import AIOKafkaProducer

from monitoring_topics import MONITORING_TOPICS


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

KAFKA_SERVER = "localhost:9092"
RAW_TOPIC = "news.raw"

# Collection settings
POLL_INTERVAL_SECONDS = 600
REQUEST_DELAY_SECONDS = 2
ARTICLES_PER_KEYWORD = 5

DB_PATH = (
    Path(__file__).resolve().parent.parent
    / "rss_collector.db"
)


def initialize_database():
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS published_articles (
                article_id TEXT PRIMARY KEY,
                published_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)


def already_published(article_id: str) -> bool:
    with sqlite3.connect(DB_PATH) as conn:
        result = conn.execute(
            """
            SELECT 1
            FROM published_articles
            WHERE article_id = ?
            """,
            (article_id,),
        ).fetchone()

    return result is not None


def mark_published(article_id: str):
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            INSERT OR IGNORE INTO published_articles
            (article_id)
            VALUES (?)
            """,
            (article_id,),
        )


def build_rss_url(keyword: str) -> str:
    query = quote_plus(keyword)

    return (
        "https://news.google.com/rss/search"
        f"?q={query}&hl=en-SG&gl=SG&ceid=SG:en"
    )


async def fetch_rss(
    client: httpx.AsyncClient,
    keyword: str,
    topic_id: str,
) -> list[dict]:

    url = build_rss_url(keyword)

    response = await client.get(url)
    response.raise_for_status()

    feed = feedparser.parse(response.content)

    articles = []

    for entry in feed.entries[:ARTICLES_PER_KEYWORD]:
        article_url = entry.get("link", "")

        if not article_url:
            continue

        article_id = hashlib.sha256(
            article_url.encode("utf-8")
        ).hexdigest()

        articles.append({
            "id": article_id,
            "title": entry.get("title", ""),
            "summary": entry.get("summary", ""),
            "url": article_url,
            "source": "Google News RSS",
            "topic_id": topic_id,
            "keyword": keyword,
            "published_at": entry.get("published", ""),
            "collected_at": datetime.now(
                timezone.utc
            ).isoformat(),
        })

    return articles


async def publish_article(
    producer: AIOKafkaProducer,
    article: dict,
):
    await producer.send_and_wait(
        RAW_TOPIC,
        article,
        key=article["id"].encode("utf-8"),
    )

    mark_published(article["id"])

    logger.info(
        "Published to Kafka: %s",
        article["title"],
    )


async def collect_cycle(
    client: httpx.AsyncClient,
    producer: AIOKafkaProducer,
):
    collected_count = 0
    published_count = 0

    for topic_id, config in MONITORING_TOPICS.items():

        logger.info(
            "Monitoring topic: %s",
            config["name"],
        )

        for keyword in config["keywords"]:

            logger.info(
                "Fetching RSS: %s",
                keyword,
            )

            try:
                articles = await fetch_rss(
                    client,
                    keyword,
                    topic_id,
                )

                collected_count += len(articles)

                for article in articles:

                    if already_published(article["id"]):
                        continue

                    await publish_article(
                        producer,
                        article,
                    )

                    published_count += 1

            except Exception:
                logger.exception(
                    "Failed processing RSS keyword: %s",
                    keyword,
                )

            await asyncio.sleep(REQUEST_DELAY_SECONDS)

    logger.info(
        "Collection complete: %d fetched, %d newly published",
        collected_count,
        published_count,
    )


async def run_collector():
    initialize_database()

    producer = AIOKafkaProducer(
        bootstrap_servers=KAFKA_SERVER,
        value_serializer=lambda value: json.dumps(
            value,
            ensure_ascii=False,
        ).encode("utf-8"),
    )

    await producer.start()

    logger.info("Kafka producer connected")

    try:
        async with httpx.AsyncClient(
            timeout=30.0,
            follow_redirects=True,
            headers={
                "User-Agent": "GeoIntelAI/1.0"
            },
        ) as client:

            while True:
                logger.info(
                    "Starting RSS collection cycle"
                )

                try:
                    await collect_cycle(
                        client,
                        producer,
                    )

                except Exception:
                    logger.exception(
                        "RSS collection cycle failed"
                    )

                logger.info(
                    "Next collection cycle in %d seconds",
                    POLL_INTERVAL_SECONDS,
                )

                await asyncio.sleep(
                    POLL_INTERVAL_SECONDS
                )

    finally:
        await producer.stop()


if __name__ == "__main__":
    try:
        asyncio.run(run_collector())
    except KeyboardInterrupt:
        logger.info("RSS collector stopped")
