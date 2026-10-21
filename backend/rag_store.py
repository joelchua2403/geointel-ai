"""Chroma storage and Ollama embeddings for GeoIntel intelligence articles."""
import asyncio
import hashlib
import os
import re
from pathlib import Path

import chromadb
import httpx

OLLAMA_BASE_URL = os.getenv('OLLAMA_BASE_URL', 'http://127.0.0.1:11434').rstrip('/')
EMBED_MODEL = os.getenv('OLLAMA_EMBED_MODEL', 'nomic-embed-text')
CHROMA_PATH = os.getenv('RAG_CHROMA_PATH', '/app/data/rag_chroma')
COLLECTION_NAME = 'geointel_intelligence_v1'

_client = None
_collection = None


def collection():
    global _client, _collection
    if _collection is None:
        Path(CHROMA_PATH).mkdir(parents=True, exist_ok=True)
        _client = chromadb.PersistentClient(path=CHROMA_PATH)
        _collection = _client.get_or_create_collection(
            name=COLLECTION_NAME, metadata={'hnsw:space': 'cosine'}
        )
    return _collection


def passages(article: dict, chunk_size: int = 1200, overlap: int = 160):
    """Chunk the text actually present in RSS history (often only title/summary)."""
    title = str(article.get('title') or '').strip()
    summary = re.sub(r'<[^>]+>', ' ', str(article.get('summary') or '')).strip()
    body = str(article.get('content') or '').strip()
    content = f'Title: {title}\nSummary: {summary}\n{body}'.strip()
    if not title or not content:
        return []
    step = chunk_size - overlap
    return [content[i:i + chunk_size] for i in range(0, len(content), step) if content[i:i + chunk_size].strip()]


async def embed_texts(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []
    async with httpx.AsyncClient(timeout=120) as client:
        response = await client.post(
            f'{OLLAMA_BASE_URL}/api/embed',
            json={'model': EMBED_MODEL, 'input': texts},
        )
        response.raise_for_status()
        data = response.json()
    vectors = data.get('embeddings')
    if not isinstance(vectors, list) or len(vectors) != len(texts):
        raise RuntimeError('Ollama returned unexpected embedding count')
    return vectors


async def index_article(article: dict) -> int:
    article_id = str(article.get('id') or '').strip()
    if not article_id:
        return 0
    chunks = passages(article)
    if not chunks:
        return 0
    embeddings = await embed_texts(chunks)
    ids = [f'{article_id}::{i}' for i in range(len(chunks))]
    meta = {
        'article_id': article_id,
        'title': str(article.get('title') or ''),
        'source': str(article.get('source') or ''),
        'url': str(article.get('url') or ''),
        'published_at': str(article.get('published_at') or ''),
        'topic_id': str(article.get('topic_id') or ''),
    }
    col = collection()
    # Upsert allows Kafka redelivery and repeated backfills.
    await asyncio.to_thread(col.upsert, ids=ids, documents=chunks,
                            embeddings=embeddings, metadatas=[meta] * len(chunks))
    return len(chunks)


async def search(question: str, limit: int = 6, max_distance: float = 0.75):
    col = collection()
    count = await asyncio.to_thread(col.count)
    if count == 0:
        return []
    vector = (await embed_texts([question]))[0]
    result = await asyncio.to_thread(
        col.query, query_embeddings=[vector], n_results=min(limit * 3, count),
        include=['documents', 'metadatas', 'distances'],
    )
    matches = []
    seen = set()
    for document, meta, distance in zip(result['documents'][0], result['metadatas'][0], result['distances'][0]):
        aid = meta['article_id']
        if aid in seen or distance > max_distance:
            continue
        seen.add(aid)
        matches.append({'id': aid, 'text': document, 'metadata': meta, 'distance': distance})
        if len(matches) >= limit:
            break
    return matches
