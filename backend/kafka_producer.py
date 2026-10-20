
import json
import logging

from aiokafka import AIOKafkaProducer


logger = logging.getLogger(__name__)

KAFKA_BOOTSTRAP_SERVERS = "localhost:9092"
RAW_NEWS_TOPIC = "news.raw"


async def publish_articles(articles: list[dict]):
    producer = AIOKafkaProducer(
        bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
        value_serializer=lambda value: json.dumps(
            value,
            ensure_ascii=False,
        ).encode("utf-8"),
    )

    await producer.start()

    try:
        for article in articles:
            await producer.send_and_wait(
                RAW_NEWS_TOPIC,
                article,
                key=str(article["id"]).encode("utf-8"),
            )

            logger.info(
                "Published article: %s",
                article["title"],
            )

    finally:
        await producer.stop()
