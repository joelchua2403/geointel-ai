
import asyncio
import json
import logging
import os

from aiokafka import AIOKafkaConsumer
from fastapi import WebSocket


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
        )

        try:
            await consumer.start()
            logger.info("Kafka WebSocket bridge started")

            async for message in consumer:
                await manager.broadcast({
                    "type": "news_article",
                    "data": message.value,
                })

        except asyncio.CancelledError:
            raise

        except Exception:
            logger.exception(
                "Kafka WebSocket bridge failed; retrying"
            )
            await asyncio.sleep(5)

        finally:
            await consumer.stop()
