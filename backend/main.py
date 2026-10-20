
import httpx

from typing import Literal
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from news_service import fetch_news
from ai_service import IntelligenceBriefing, generate_briefing




app = FastAPI(title="GeoIntel AI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

class Article(BaseModel):
    id: str
    title: str
    category: str
    country: str
    summary: str
    source: str
    url: str
    published_at: str

class BriefingRequest(BaseModel):
    articles: list[Article]


@app.post(
    "/api/briefing",
    response_model=IntelligenceBriefing
)
async def create_briefing(request: BriefingRequest):
    if not 1 <= len(request.articles) <= 20:
        raise HTTPException(
            status_code=400,
            detail="Provide between 1 and 20 articles"
        )

    try:
        return await generate_briefing(
            [article.model_dump() for article in request.articles]
        )
    except Exception as e:
        print(f"AI ERROR: {type(e).__name__}: {e}")
        raise HTTPException(
            status_code=502,
            detail="AI briefing generation failed"
        )

@app.get("/api/health")
def health():
    return {"status": "healthy"}

Category = Literal[
    "all",
    "world",
    "politics",
    "business",
    "technology",
    "environment",
    "science",
]


@app.get("/api/articles", response_model=list[Article])
async def get_articles(
    query: str = Query(default="", max_length=100),
    category: Category = "world",
):
    try:
        return await fetch_news(
            query=query,
            category=category,
        )
    except (httpx.HTTPError, ValueError, KeyError):
        raise HTTPException(
            status_code=502,
            detail="Unable to retrieve news articles",
        )
    except RuntimeError:
        raise HTTPException(
            status_code=503,
            detail="News provider is not configured",
        )
