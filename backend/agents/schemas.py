
from datetime import datetime
from pydantic import BaseModel, Field, HttpUrl


class Source(BaseModel):
    id: str
    title: str
    url: HttpUrl
    published_at: datetime | None = None


class Development(BaseModel):
    title: str
    description: str
    significance: str
    source_ids: list[str] = Field(min_length=1)


class IntelligenceReport(BaseModel):
    title: str
    executive_summary: str = Field(min_length=50)
    key_developments: list[Development] = Field(
        min_length=1,
        max_length=5,
    )
    geopolitical_analysis: str
    outlook: str
    limitations: list[str]
    sources: list[Source]
