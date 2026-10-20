
import os

import httpx
from dotenv import load_dotenv

load_dotenv()

GUARDIAN_URL = "https://content.guardianapis.com/search"

CATEGORIES = {
    "all": None,
    "world": "world",
    "politics": "politics",
    "business": "business",
    "technology": "technology",
    "environment": "environment",
    "science": "science",
}


async def fetch_news(
    query: str = "",
    category: str = "world"
):
    api_key = os.getenv("GUARDIAN_API_KEY")

    if not api_key:
        raise RuntimeError("Missing Guardian API key")

    params = {
        "api-key": api_key,
        "page-size": 20,
        "order-by": "newest",
    }

    # Add search keyword if provided
    if query.strip():
        params["q"] = query.strip()

    # Add category filter
    section = CATEGORIES[category]

    if section:
        params["section"] = section

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(
            GUARDIAN_URL,
            params=params
        )
        response.raise_for_status()

    data = response.json()

    return [
        {
            "id": item["id"],
            "title": item["webTitle"],
            "category": item["sectionName"],
            "country": "International",
            "summary": "",
            "source": "The Guardian",
            "url": item["webUrl"],
            "published_at": item["webPublicationDate"],
        }
        for item in data["response"]["results"]
    ]
