from typing import TypedDict


class IntelState(TypedDict, total=False):
    query: str
    articles: list[dict]
    analysis: str
    verification: str
    verified: bool
    briefing: str
    report_title: str
    pdf_path: str