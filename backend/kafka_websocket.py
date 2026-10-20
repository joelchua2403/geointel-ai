
import asyncio
import json
import logging
import os

from aiokafka import AIOKafkaConsumer
from fastapi import WebSocket
from intelligence_history import save_article


logger = logging.getLogger(__name__)

KAFKA_SERVER = os.getenv(
    "KAFKA_BOOTSTRAP_SERVERS",
    "localhost:9092",
)

PROCESSED_TOPIC = "news.processed"


class ConnectionManager:
    def __init__(self):
        self.active_connections: set[WebSocket] = set()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)

        logger.info(
            "WebSocket connected. Clients: %d",
            len(self.active_connections),
        )

    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)

    async def broadcast(self, message: dict):
        disconnected = []

        for websocket in list(self.active_connections):
            try:
                await websocket.send_json(message)
            except Exception:
                logger.exception(
                    "Failed to send WebSocket message"
                )
                disconnected.append(websocket)

        for websocket in disconnected:
            self.disconnect(websocket)


manager = ConnectionManager()


async def consume_processed_news():
    while True:
        consumer = AIOKafkaConsumer(
            PROCESSED_TOPIC,
            bootstrap_servers=KAFKA_SERVER,
            group_id="geointel-websocket-bridge",
            auto_offset_reset="latest",
            value_deserializer=lambda value: json.loads(
                value.decode("utf-8")
            ),
            enable_auto_commit=False,
        )

        try:
            await consumer.start()
            logger.info("Kafka WebSocket bridge started")

            async for message in consumer:
                article = message.value

                try:
                    # Save processed article to SQLite
                    await asyncio.to_thread(
                        save_article,
                        article,
                    )

                    logger.info(
                        "Saved intelligence article: %s",
                        article.get("title", "Unknown"),
                    )

                    # Broadcast article to connected clients
                    await manager.broadcast({
                        "type": "news_article",
                        "data": article,
                    })

                    # Commit only after successful processing
                    await consumer.commit()

                except Exception:
                    logger.exception(
                        "Failed to process intelligence article"
                    )
                    # Do not commit a failed message.
                    # Restart the consumer to retry it.
                    raise

        except asyncio.CancelledError:
            raise

        except Exception:
            logger.exception(
                "Kafka WebSocket bridge failed; retrying"
            )
            await asyncio.sleep(5)

        finally:
            await consumer.stop()
