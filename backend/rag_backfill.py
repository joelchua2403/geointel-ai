"""Run once (or repeatedly) to index all saved intelligence history."""
import asyncio
import json
import logging

from intelligence_history import connect, init_history
from rag_store import index_article

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def main():
    init_history()
    last_id = ''
    indexed = 0
    failed = 0
    while True:
        with connect() as conn:
            rows = conn.execute(
                'SELECT id, payload FROM intelligence_articles WHERE id > ? ORDER BY id LIMIT 100',
                (last_id,),
            ).fetchall()
        if not rows:
            break
        for row in rows:
            last_id = row['id']
            try:
                indexed += await index_article(json.loads(row['payload']))
            except Exception:
                failed += 1
                logger.exception('Failed to index article %s', last_id)
        logger.info('Indexed passages: %s; failures: %s', indexed, failed)
    logger.info('Finished: %s passages; %s failed articles', indexed, failed)
    if failed:
        raise SystemExit(1)


if __name__ == '__main__':
    asyncio.run(main())
