import json
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

DB_PATH = Path(
    os.getenv(
        "INTELLIGENCE_DB_PATH",
        "/app/data/intelligence_history.db",
    )
)


def connect():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(DB_PATH, timeout=30)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA busy_timeout = 5000")
    return conn


def init_history():
    with connect() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS intelligence_articles (
                id TEXT PRIMARY KEY,
                payload TEXT NOT NULL,
                received_at TEXT NOT NULL
            )
        """)

        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_intelligence_received
            ON intelligence_articles(received_at DESC)
        """)


def save_article(article: dict):
    article_id = str(article.get("id") or "").strip()

    if not article_id:
        raise ValueError("Article is missing an id")

    received_at = datetime.now(timezone.utc).isoformat()

    with connect() as conn:
        conn.execute(
            """
            INSERT INTO intelligence_articles
                (id, payload, received_at)
            VALUES (?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                payload = excluded.payload
            """,
            (
                article_id,
                json.dumps(article, ensure_ascii=False),
                received_at,
            ),
        )


def get_articles(limit: int = 50):
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT payload
            FROM intelligence_articles
            ORDER BY received_at DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()

    return [json.loads(row["payload"]) for row in rows]