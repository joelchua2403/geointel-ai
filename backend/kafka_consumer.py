
import asyncio
import json
import logging
import re
import sqlite3
from pathlib import Path

from aiokafka import AIOKafkaConsumer, AIOKafkaProducer

from monitoring_topics import MONITORING_TOPICS


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

KAFKA_SERVER = "localhost:9092"
RAW_TOPIC = "news.raw"
PROCESSED_TOPIC = "news.processed"

DB_PATH = Path(__file__).resolve().parent / "kafka_processed.db"


def initialize_database():
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS processed_articles (
                article_id TEXT PRIMARY KEY,
                processed_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)


def already_processed(article_id: str) -> bool:
    with sqlite3.connect(DB_PATH) as conn:
        result = conn.execute(
            "SELECT 1 FROM processed_articles WHERE article_id = ?",
            (article_id,),
        ).fetchone()

    return result is not None


def mark_processed(article_id: str):
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            "INSERT OR IGNORE INTO processed_articles (article_id) VALUES (?)",
            (article_id,),
        )



def find_matching_topics(article: dict) -> list[str]:
    title = str(article.get("title", ""))
    summary = str(article.get("summary", ""))

    text = f"{title} {summary}"

    # Remove HTML tags and normalize text
    text = re.sub(r"<[^>]+>", " ", text).casefold()

    matches = []

    maritime_terms = [
        "maritime",
        "naval",
        "navy",
        "shipping",
        "ship",
        "vessel",
        "coast guard",
        "sea",
        "ocean",
        "strait",
        "tanker",
        "warship",
    ]

    for topic_id, config in MONITORING_TOPICS.items():
        keywords = config["keywords"]

        keyword_match = any(
            keyword.casefold() in text
            for keyword in keywords
        )

        if topic_id == "maritime-security":
            maritime_match = any(
                re.search(
                    rf"\b{re.escape(term)}\b",
                    text,
                )
                for term in maritime_terms
            )

            piracy_match = bool(
                re.search(r"\bpiracy\b|\bpirates?\b", text)
            )

            # Piracy alone is not enough.
            # Require a maritime context.
            if piracy_match and not maritime_match:
                continue

            # Also recognize maritime/naval reporting
            # even if exact configured keywords are absent.
            if maritime_match:
                matches.append(topic_id)

        elif keyword_match:
            matches.append(topic_id)

    return matches


async def consume_news():
    initialize_database()

    consumer = AIOKafkaConsumer(
        RAW_TOPIC,
        bootstrap_servers=KAFKA_SERVER,
        group_id="geointel-news-processor",
        enable_auto_commit=False,
        auto_offset_reset="earliest",
        value_deserializer=lambda value: json.loads(
            value.decode("utf-8")
        ),
    )

    producer = AIOKafkaProducer(
        bootstrap_servers=KAFKA_SERVER,
        value_serializer=lambda value: json.dumps(
            value,
            ensure_ascii=False,
        ).encode("utf-8"),
    )

    await consumer.start()
    await producer.start()

    logger.info("Kafka consumer started")

    try:
        async for message in consumer:
            article = message.value
            article_id = str(article.get("id", ""))

            if not article_id:
                logger.warning("Skipping article without ID")
                await consumer.commit()
                continue

            if already_processed(article_id):
                logger.info("Duplicate skipped: %s", article_id)
                await consumer.commit()
                continue

            matching_topics = find_matching_topics(article)

            if not matching_topics:
                logger.info(
                    "Article not relevant: %s",
                    article.get("title", ""),
                )
                await consumer.commit()
                continue

            processed_article = {
                **article,
                "matching_topics": matching_topics,
                "relevance_score": len(matching_topics),
                "status": "processed",
            }

            await producer.send_and_wait(
                PROCESSED_TOPIC,
                processed_article,
                key=article_id.encode("utf-8"),
            )

            mark_processed(article_id)

            await consumer.commit()

            logger.info(
                "Processed: %s | Topics: %s",
                article.get("title", ""),
                matching_topics,
            )

    finally:
        await consumer.stop()
        await producer.stop()


if __name__ == "__main__":
    asyncio.run(consume_news())
