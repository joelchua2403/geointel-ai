# GeoIntel AI RAG patch (backend phase)

These files are additive. **Do not overwrite your existing ai_service.py, database.py, intelligence_history.py, or Kafka consumer.**

## Files
- `rag_store.py`: Chroma persistence + Ollama embeddings + semantic search.
- `rag_backfill.py`: imports **all** rows from your existing `intelligence_articles` table.
- `rag_api.py`: `POST /api/rag/query` using your existing Ollama model setting.
- `requirements-rag.txt`: extra dependency.

## Install

1. Copy `rag_store.py`, `rag_backfill.py`, and `rag_api.py` into `backend/`.
2. Add `chromadb>=0.5,<2` to your backend's `requirements.txt`, then rebuild/reinstall.
3. Run Ollama and pull the embedding model: `ollama pull nomic-embed-text`. Your existing chat model must also be available.
4. In `main.py`, add:

   ```python
   from rag_api import router as rag_router
   app.include_router(rag_router)
   ```

   Add `app.include_router(...)` **after** the `app = FastAPI(...)` declaration.
5. Set environment variables. If Ollama runs on your Windows host and backend runs in Docker Desktop, example:

   ```yaml
   environment:
     OLLAMA_BASE_URL: http://host.docker.internal:11434
     OLLAMA_URL: http://host.docker.internal:11434/api/generate
     OLLAMA_EMBED_MODEL: nomic-embed-text
     RAG_CHROMA_PATH: /app/data/rag_chroma
   ```

   Ollama must listen on an interface reachable from the container. Keep Ollama private; don't expose it to the public internet. If Ollama runs as another Compose service, use its Compose service name instead.
6. Ensure the backend volume already holding `/app/data/intelligence_history.db` also persists `/app/data/rag_chroma`. The default history and Chroma paths assume a Docker deployment. For local Python execution, set `INTELLIGENCE_DB_PATH` and `RAG_CHROMA_PATH` to writable local paths.
7. Index existing news:

   ```bash
   docker compose exec backend python rag_backfill.py
   ```

8. Test in Swagger (`/docs`) or via:

   ```bash
   curl -X POST http://localhost:8080/api/rag/query \
     -H 'Content-Type: application/json' \
     -d '{"question":"What are the recent maritime security developments?","limit":5}'
   ```

   Replace port 8080 with your actual published backend port.

## Important scope / follow-up integration

- The indexer currently runs as a **backfill job**, not an automatic Kafka subscriber. Re-running it updates vectors idempotently.
- For automatic updates, integrate `await index_article(article)` into your existing **FastAPI `news.processed` bridge** *after* it successfully saves an article, or run a dedicated Kafka consumer group. Do **not** insert it into `kafka_consumer.py` without understanding its role: that file processes `news.raw`, and embedding failures must not block news processing.
- The supplied files don't include `main.py`, the WebSocket bridge, `docker-compose.yml`, `requirements.txt`, or React source. Those are needed to make and verify exact project-specific edits.
- Indexes currently use title, summary and any `content` field. If RSS contains only short summaries, the AI cannot reliably answer deep questions requiring full article text.
- This prototype is not yet date-filtered, reranked, or hardened with user authentication and query rate limiting. Use only with trusted users until those controls are added.
- Do not mix embedding models in the same collection without rebuilding it; embeddings from different models may have incompatible dimensions and semantics.
