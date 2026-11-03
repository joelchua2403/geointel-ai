
import asyncio
from collections import defaultdict
from typing import Any


class ReportProgressManager:
    def __init__(self):
        self.history: dict[str, list[dict[str, Any]]] = (
            defaultdict(list)
        )
        self.subscribers: dict[
            str, set[asyncio.Queue]
        ] = defaultdict(set)

    def publish(self, job_id: str, event: dict):
        event = {
            "job_id": job_id,
            "sequence": len(self.history[job_id]) + 1,
            **event,
        }

        self.history[job_id].append(event)

        for queue in list(self.subscribers[job_id]):
            queue.put_nowait(event)

    def subscribe(self, job_id: str):
        queue = asyncio.Queue()

        # Subscribe and snapshot without awaiting,
        # so events cannot be lost between these steps.
        self.subscribers[job_id].add(queue)
        history = list(self.history[job_id])

        return queue, history

    def unsubscribe(self, job_id: str, queue):
        self.subscribers[job_id].discard(queue)

    def cleanup(self, job_id: str):
        self.history.pop(job_id, None)
        self.subscribers.pop(job_id, None)


progress_manager = ReportProgressManager()
