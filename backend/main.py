
import logging
from typing import Literal

import httpx

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, ValidationError

from news_service import fetch_news
from ai_service import IntelligenceBriefing, generate_briefing
from strategic_sites import router as strategic_sites_router
import asyncio
from contextlib import asynccontextmanager, suppress

from fastapi import WebSocket, WebSocketDisconnect
from kafka_websocket import manager, consume_processed_news
from intelligence_history import (
    init_history,
    get_articles as get_intelligence_history,
)

# ==========================================
# LOGGING
# ==========================================

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(name)s - %(message)s",
)

logger = logging.getLogger(__name__)


# ==========================================
# FASTAPI APPLICATION
# ==========================================


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize SQLite intelligence history database
    init_history()

    # Start Kafka consumer for real-time intelligence
    kafka_task = asyncio.create_task(
        consume_processed_news()
    )

    try:
        yield
    finally:
        # Stop Kafka consumer gracefully
        kafka_task.cancel()

        with suppress(asyncio.CancelledError):
            await kafka_task

app = FastAPI(
    title="GeoIntel AI API",
    description="AI-Powered Geopolitical Intelligence Platform",
    version="1.0.0",
    lifespan=lifespan,
)


app.include_router(strategic_sites_router)


# ==========================================
# CORS CONFIGURATION
# ==========================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type"],
)


# ==========================================
# REQUEST / RESPONSE MODELS
# ==========================================

class Article(BaseModel):
    id: str
    title: str
    category: str = "world"
    country: str = ""
    summary: str = ""
    source: str = ""
    url: str = ""
    published_at: str = ""


class BriefingRequest(BaseModel):
    articles: list[Article] = Field(
        min_length=1,
        max_length=20,
    )


Category = Literal[
    "all",
    "world",
    "politics",
    "business",
    "technology",
    "environment",
    "science",
]


# ==========================================
# HEALTH CHECK
# ==========================================

@app.get("/api/health")
async def health():
    return {
        "status": "healthy",
        "service": "GeoIntel AI API",
        "version": "1.0.0",
    }


# ==========================================
# NEWS API
# ==========================================

@app.get(
    "/api/articles",
    response_model=list[Article],
)
async def get_articles(
    query: str = Query(
        default="",
        max_length=100,
    ),
    category: Category = "world",
):
    try:
        logger.info(
            "Fetching news: query=%s, category=%s",
            query,
            category,
        )

        articles = await fetch_news(
            query=query,
            category=category,
        )

        logger.info(
            "Retrieved %d articles",
            len(articles),
        )

        return articles

    except RuntimeError as exc:
        logger.exception("News provider configuration error")

        raise HTTPException(
            status_code=503,
            detail="News provider is not configured",
        ) from exc

    except (httpx.HTTPError, ValueError, KeyError) as exc:
        logger.exception("News retrieval failed")

        raise HTTPException(
            status_code=502,
            detail="Unable to retrieve news articles",
        ) from exc


# ==========================================
# AI INTELLIGENCE BRIEFING
# ==========================================

@app.post(
    "/api/briefing",
    response_model=IntelligenceBriefing,
)
async def create_briefing(
    request: BriefingRequest,
):
    logger.info(
        "AI briefing requested for %d articles",
        len(request.articles),
    )

    try:
        articles = [
            article.model_dump()
            for article in request.articles
        ]

        # Generate AI briefing through ai_service.py
        result = await generate_briefing(articles)

        # --------------------------------------
        # CHECK FOR EMPTY AI RESPONSE
        # --------------------------------------

        if result is None:
            logger.error("AI service returned None")

            raise HTTPException(
                status_code=502,
                detail="AI model returned no response",
            )

        if isinstance(result, str):
            if not result.strip():
                logger.error("AI service returned empty text")

                raise HTTPException(
                    status_code=502,
                    detail="AI model returned an empty response",
                )

            # Validate JSON text from AI service
            briefing = IntelligenceBriefing.model_validate_json(
                result
            )

        elif isinstance(result, IntelligenceBriefing):
            briefing = result

        else:
            # Validate dictionary or compatible object
            briefing = IntelligenceBriefing.model_validate(
                result
            )

        logger.info(
            "AI briefing successfully generated"
        )

        return briefing

    # --------------------------------------
    # PRESERVE INTENTIONAL HTTP ERRORS
    # --------------------------------------

    except HTTPException:
        raise

    # --------------------------------------
    # PYDANTIC VALIDATION ERRORS
    # --------------------------------------

    except ValidationError as exc:
        logger.error(
            "AI briefing schema validation failed: %s",
            exc,
        )

        errors = exc.errors()

        is_empty_json = any(
            error.get("type") == "json_invalid"
            and not str(error.get("input", "")).strip()
            for error in errors
        )

        if is_empty_json:
            raise HTTPException(
                status_code=502,
                detail=(
                    "Ollama generated an empty JSON response. "
                    "Check ai_service.py and Ollama generation settings."
                ),
            ) from exc

        raise HTTPException(
            status_code=502,
            detail=(
                "AI briefing output did not match "
                "the required JSON schema"
            ),
        ) from exc

    # --------------------------------------
    # OLLAMA CONNECTION ERRORS
    # --------------------------------------

    except httpx.ConnectError as exc:
        logger.exception("Cannot connect to Ollama")

        raise HTTPException(
            status_code=503,
            detail=(
                "Cannot connect to Ollama. "
                "Check that Ollama is running on port 11434."
            ),
        ) from exc

    # --------------------------------------
    # OLLAMA TIMEOUT
    # --------------------------------------

    except httpx.TimeoutException as exc:
        logger.exception("Ollama request timed out")

        raise HTTPException(
            status_code=504,
            detail=(
                "Ollama generation timed out. "
                "Try reducing the number of articles."
            ),
        ) from exc

    # --------------------------------------
    # OTHER HTTP ERRORS
    # --------------------------------------

    except httpx.HTTPError as exc:
        logger.exception("AI service HTTP error")

        raise HTTPException(
            status_code=502,
            detail="AI model service returned an HTTP error",
        ) from exc

    # --------------------------------------
    # UNEXPECTED ERRORS
    # --------------------------------------

    except Exception as exc:
        logger.exception(
            "Unexpected AI briefing generation error"
        )

        raise HTTPException(
            status_code=502,
            detail=(
                "AI briefing generation failed: "
                f"{type(exc).__name__}"
            ),
        ) from exc



@app.websocket("/ws/intelligence")
async def intelligence_websocket(websocket: WebSocket):
    await manager.connect(websocket)

    try:
        while True:
            # Keep connection alive and detect disconnects.
            await websocket.receive_text()

    except WebSocketDisconnect:
        manager.disconnect(websocket)

    except Exception:
        manager.disconnect(websocket)
        logger.exception("WebSocket connection closed")

@app.get("/api/intelligence")
def list_intelligence(limit: int = 100):
    limit = max(1, min(limit, 200))
    return get_intelligence_history(limit)