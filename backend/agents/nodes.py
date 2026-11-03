
import json
import os
import sys
from pathlib import Path
from typing import Any

from pydantic import BaseModel, Field, ValidationError
from langchain.agents import create_agent
from langchain_core.messages import (
    HumanMessage,
    SystemMessage,
    ToolMessage,
)
from langchain_mcp_adapters.client import MultiServerMCPClient
from langchain_ollama import ChatOllama

from .state import IntelState
from .schemas import IntelligenceReport
from .pdf_generator import generate_pdf


# =========================================================
# CONFIGURATION
# =========================================================

OLLAMA_BASE_URL = os.getenv(
    "OLLAMA_BASE_URL",
    "http://localhost:11434",
)

AGENT_MODEL = os.getenv(
    "AGENT_MODEL",
    "qwen2.5:1.5b",
)

MCP_SERVER_PATH = os.getenv(
    "MCP_SERVER_PATH",
    str(
        Path(__file__).resolve().parents[1]
        / "mcp_server.py"
    ),
)

GEOINTEL_API_URL = os.getenv(
    "GEOINTEL_API_URL",
    "http://127.0.0.1:8000",
)


# =========================================================
# OLLAMA CLIENT
# =========================================================

llm = ChatOllama(
    model=AGENT_MODEL,
    base_url=OLLAMA_BASE_URL,
    temperature=0.1,
)

report_llm = llm.with_structured_output(
    IntelligenceReport,
    method="json_schema",
)


# =========================================================
# MCP CLIENT
# =========================================================

mcp_client = MultiServerMCPClient(
    {
        "geointel": {
            "transport": "stdio",
            "command": sys.executable,
            "args": [MCP_SERVER_PATH],
            "env": {
                **os.environ,
                "GEOINTEL_API_URL": GEOINTEL_API_URL,
            },
        }
    }
)


# =========================================================
# PYDANTIC SCHEMAS
# =========================================================

class ResearchSource(BaseModel):
    id: str
    title: str
    url: str
    summary: str = ""


class ResearchResult(BaseModel):
    summary: str
    sources: list[ResearchSource] = Field(
        default_factory=list
    )


class AnalysisResult(BaseModel):
    key_developments: list[str] = Field(
        default_factory=list
    )
    geopolitical_implications: list[str] = Field(
        default_factory=list
    )
    trends: list[str] = Field(
        default_factory=list
    )
    uncertainties: list[str] = Field(
        default_factory=list
    )


class VerificationResult(BaseModel):
    verified: bool
    explanation: str
    unsupported_claims: list[str] = Field(
        default_factory=list
    )


# =========================================================
# HELPER FUNCTIONS
# =========================================================

def to_json(value: Any) -> str:
    """Serialize values for LLM prompts."""

    return json.dumps(
        value,
        ensure_ascii=False,
        default=str,
        indent=2,
    )


def extract_tool_results(messages: list) -> list[dict]:
    """Collect MCP tool results and preserve error status."""
    results = []
    for message in messages:
        if isinstance(message, ToolMessage):
            results.append({
                "tool": message.name,
                "content": message.content,
                "is_error": getattr(message, "status", "") == "error",
            })
    return results


def parse_tool_content(content: Any) -> Any:
    """Decode JSON strings and MCP text content blocks."""
    if isinstance(content, str):
        try:
            return parse_tool_content(json.loads(content))
        except json.JSONDecodeError:
            return content

    if isinstance(content, list):
        parsed_items = []
        for item in content:
            if isinstance(item, dict) and "text" in item and item.get("type") in (None, "text"):
                parsed = parse_tool_content(item["text"])
            else:
                parsed = parse_tool_content(item)
            if isinstance(parsed, list):
                parsed_items.extend(parsed)
            else:
                parsed_items.append(parsed)
        if len(parsed_items) == 1:
            return parsed_items[0]
        return parsed_items

    return content


def log_tool_result_structure(tool_results: list[dict]) -> None:
    """Log response shape without exposing API keys or article bodies."""
    print("[Research Agent] MCP tool results:", len(tool_results), flush=True)
    for index, result in enumerate(tool_results, start=1):
        content = result.get("content")
        parsed = parse_tool_content(content)
        print(f"[Research Agent] Tool {index}: {result.get('tool')}", flush=True)
        print("[Research Agent] Raw content type:", type(content).__name__, flush=True)
        print("[Research Agent] Parsed content type:", type(parsed).__name__, flush=True)
        if isinstance(parsed, dict):
            print("[Research Agent] Response keys:", list(parsed.keys()), flush=True)
        elif isinstance(parsed, list):
            print("[Research Agent] List length:", len(parsed), flush=True)
            if parsed and isinstance(parsed[0], dict):
                print("[Research Agent] First item keys:", list(parsed[0].keys()), flush=True)
        print("[Research Agent] Tool error:", result.get("is_error"), flush=True)


def normalize_sources(
    tool_results: list[dict],
) -> list[dict]:
    """
    Build a trusted source registry from
    actual MCP tool responses.

    Never let the LLM invent source IDs.
    """

    sources = []
    seen = set()

    def add_source(article: dict):
        if not isinstance(article, dict):
            return

        title = article.get("title")
        url = (
            article.get("url")
            or article.get("link")
        )

        if not title or not url:
            return

        if url in seen:
            return

        seen.add(url)

        source = {
            "id": f"source_{len(sources) + 1}",
            "title": str(title),
            "url": str(url),
            "summary": str(
                article.get("summary")
                or article.get("description")
                or ""
            ),
        }

        published_at = (
            article.get("published_at")
            or article.get("publishedAt")
        )

        if published_at:
            source["published_at"] = published_at

        sources.append(source)

    for tool_result in tool_results:
        if tool_result.get("is_error"):
            continue

        data = parse_tool_content(
            tool_result["content"]
        )

        if isinstance(data, dict):
            articles = (
                data.get("articles")
                or data.get("sources")
                or []
            )

            if isinstance(articles, list):
                for article in articles:
                    add_source(article)

        elif isinstance(data, list):
            for article in data:
                add_source(article)

    return sources


# =========================================================
# 1. RESEARCH AGENT
# =========================================================

async def research_agent(
    state: IntelState,
) -> dict:
    """
    Uses the existing GeoIntel MCP server
    to retrieve geopolitical intelligence.

    Available MCP tools:
    - get_recent_news
    - search_intelligence
    """

    print("[Research Agent] Starting research")

    tools = await mcp_client.get_tools()

    if not tools:
        raise RuntimeError(
            "No MCP tools discovered. "
            "Check MCP_SERVER_PATH."
        )

    agent = create_agent(
        model=llm,
        tools=tools,
        system_prompt=(
            "You are GeoIntel AI's geopolitical "
            "research agent.\n"
            "Use available MCP tools to retrieve "
            "relevant intelligence.\n"
            "Use get_recent_news for recent events.\n"
            "Use search_intelligence for historical "
            "context and semantic retrieval.\n"
            "Call tools when evidence is needed.\n"
            "Do not invent facts or citations.\n"
            "Summarize only what the tools return."
        ),
    )

    question = state["query"]

    if state.get("research_retries", 0) > 0:
        question += (
            "\nPrevious verification failed. "
            "Retrieve additional evidence and "
            "investigate unsupported claims."
        )

    result = await agent.ainvoke(
        {
            "messages": [
                HumanMessage(content=question)
            ]
        },
        config={"recursion_limit": 12},
    )

    messages = result["messages"]

    tool_results = extract_tool_results(messages)
    log_tool_result_structure(tool_results)

    if not tool_results:
        return {
            "articles": [],
            "research_summary": (
                "No MCP evidence was retrieved."
            ),
        }

    sources = normalize_sources(tool_results)

    # Diagnose why MCP articles are not being normalized.
    for tool_result in tool_results:
        data = parse_tool_content(tool_result.get("content"))
        if not isinstance(data, dict):
            print("[Research Agent] Parsed response type:", type(data).__name__, flush=True)
            continue

        articles = data.get("articles")
        print("[Research Agent] Article count:", data.get("count"), flush=True)
        print("[Research Agent] Articles type:", type(articles).__name__, flush=True)

        if isinstance(articles, list):
            print("[Research Agent] Articles length:", len(articles), flush=True)
            if articles:
                first = articles[0]
                print(
                    "[Research Agent] First article keys:",
                    list(first.keys()) if isinstance(first, dict) else type(first).__name__,
                    flush=True,
                )
        elif isinstance(articles, dict):
            print("[Research Agent] Articles dictionary keys:", list(articles.keys()), flush=True)
    if not sources:
        print("[Research Agent] Retrieved 0 sources; inspect MCP response keys above", flush=True)
        return {
            "articles": [],
            "research_summary": "No normalized source records were returned by MCP tools.",
        }

    summarizer = llm.with_structured_output(
        ResearchResult,
        method="json_schema",
    )

    research = await summarizer.ainvoke(
        [
            SystemMessage(
                content=(
                    "Summarize the research evidence. "
                    "Use only supplied source records. "
                    "Do not invent sources."
                )
            ),
            HumanMessage(
                content=to_json(
                    {
                        "question": question,
                        "sources": sources,
                        "tool_results": tool_results,
                    }
                )
            ),
        ]
    )

    print(
        "[Research Agent] Retrieved",
        len(sources),
        "sources",
    )

    return {
        "articles": sources,
        "research_summary": research.summary,
    }


# =========================================================
# 2. ANALYSIS AGENT
# =========================================================

async def analysis_agent(
    state: IntelState,
) -> dict:
    """
    Analyzes the retrieved intelligence
    using structured Pydantic output.
    """

    print("[Analysis Agent] Analyzing intelligence")

    analyzer = llm.with_structured_output(
        AnalysisResult,
        method="json_schema",
    )

    analysis = await analyzer.ainvoke(
        [
            SystemMessage(
                content=(
                    "You are a geopolitical intelligence "
                    "analyst.\n"
                    "Identify significant developments, "
                    "implications, trends, and uncertainties.\n"
                    "Base conclusions only on the supplied "
                    "research evidence.\n"
                    "Distinguish facts from interpretation."
                )
            ),
            HumanMessage(
                content=to_json(
                    {
                        "query": state["query"],
                        "research_summary": state.get(
                            "research_summary", ""
                        ),
                        "sources": state.get(
                            "articles", []
                        ),
                    }
                )
            ),
        ]
    )

    return {
        "analysis": analysis.model_dump_json(
            indent=2
        ),
    }


# =========================================================
# 3. VERIFICATION AGENT
# =========================================================

async def verification_agent(
    state: IntelState,
) -> dict:
    """
    Checks whether the analysis is supported
    by the retrieved evidence.

    This is LLM-assisted verification.
    It does not independently establish
    that external claims are true.
    """

    print("[Verification Agent] Checking evidence")

    sources = state.get("articles", [])

    if not sources:
        return {
            "verified": False,
            "verification": (
                "No sources available for verification."
            ),
            "research_retries": (
                state.get("research_retries", 0) + 1
            ),
        }

    verifier = llm.with_structured_output(
        VerificationResult,
        method="json_schema",
    )

    result = await verifier.ainvoke(
        [
            SystemMessage(
                content=(
                    "You are an intelligence verification "
                    "assistant.\n"
                    "Check whether each major analytical "
                    "claim is supported by supplied evidence.\n"
                    "Reject unsupported factual claims.\n"
                    "Do not treat source existence alone "
                    "as proof of a claim."
                )
            ),
            HumanMessage(
                content=to_json(
                    {
                        "analysis": state.get(
                            "analysis", ""
                        ),
                        "research_summary": state.get(
                            "research_summary", ""
                        ),
                        "sources": sources,
                    }
                )
            ),
        ]
    )

    retries = state.get(
        "research_retries", 0
    )

    if not result.verified:
        retries += 1

    return {
        "verified": result.verified,
        "verification": to_json(
            result.model_dump()
        ),
        "research_retries": retries,
    }


# =========================================================
# 4. REPORT WRITER AGENT
# =========================================================

async def report_writer_agent(
    state: IntelState,
) -> dict:
    """
    Generates the structured intelligence
    report using the IntelligenceReport
    Pydantic schema.
    """

    print("[Report Writer] Generating report")

    try:
        report = await report_llm.ainvoke(
            [
                SystemMessage(
                    content=(
                        "You are a professional geopolitical "
                        "intelligence report writer.\n"
                        "Generate a detailed intelligence "
                        "report using the required schema.\n"
                        "Use only the supplied evidence.\n"
                        "Never invent sources or URLs.\n"
                        "Use source IDs exactly as provided.\n"
                        "Separate facts, analysis, and outlook.\n"
                        "Clearly explain limitations."
                    )
                ),
                HumanMessage(
                    content=to_json(
                        {
                            "query": state["query"],
                            "research_summary": state.get(
                                "research_summary", ""
                            ),
                            "analysis": state.get(
                                "analysis", ""
                            ),
                            "verification": state.get(
                                "verification", ""
                            ),
                            "sources": state.get(
                                "articles", []
                            ),
                            "previous_validation_error":
                                state.get(
                                    "validation_error", ""
                                ),
                        }
                    )
                ),
            ]
        )

        if report is None:
            raise ValueError(
                "LLM returned an empty report."
            )

        report = IntelligenceReport.model_validate(
            report
        )

        # Trusted source IDs come from MCP,
        # not from the report-writing LLM.
        trusted_sources = {
            source["id"]: source
            for source in state.get("articles", [])
        }

        if not report.sources:
            raise ValueError(
                "Report must include sources."
            )

        for source in report.sources:
            trusted = trusted_sources.get(source.id)

            if trusted is None:
                raise ValueError(
                    f"Untrusted source ID: {source.id}"
                )

            if str(source.url) != trusted["url"]:
                raise ValueError(
                    f"Source URL mismatch: {source.id}"
                )

        # Validate that cited IDs are actually
        # included in the final report.
        report_source_ids = {
            source.id for source in report.sources
        }

        for development in report.key_developments:
            for source_id in development.source_ids:
                if source_id not in report_source_ids:
                    raise ValueError(
                        f"Unknown citation: {source_id}"
                    )

        return {
            "report": report.model_dump(
                mode="json"
            ),
            "report_valid": True,
            "validation_error": "",
        }

    except (ValidationError, ValueError) as exc:
        print(
            "[Report Writer] Validation failed:",
            exc,
        )

        return {
            "report_valid": False,
            "validation_error": str(exc),
            "report_retries": (
                state.get("report_retries", 0) + 1
            ),
        }


# =========================================================
# 5. PYDANTIC VALIDATION NODE
# =========================================================

async def validate_report_node(
    state: IntelState,
) -> dict:
    """
    Performs final validation before
    PDF generation.
    """

    print("[Validation] Validating report")

    try:
        report = IntelligenceReport.model_validate(
            state["report"]
        )

        trusted_sources = {
            source["id"]: source
            for source in state.get("articles", [])
        }

        for source in report.sources:
            trusted = trusted_sources.get(source.id)

            if (
                trusted is None
                or str(source.url) != trusted["url"]
            ):
                raise ValueError(
                    f"Untrusted source: {source.id}"
                )

        return {
            "report": report.model_dump(
                mode="json"
            ),
            "report_valid": True,
            "validation_error": "",
        }

    except (
        ValidationError,
        ValueError,
        KeyError,
    ) as exc:

        return {
            "report_valid": False,
            "validation_error": str(exc),
            "report_retries": (
                state.get("report_retries", 0) + 1
            ),
        }


# =========================================================
# 6. PDF GENERATOR NODE
# =========================================================

async def pdf_generator_node(
    state: IntelState,
) -> dict:
    """
    Generates a PDF from the validated
    Pydantic intelligence report.
    """

    print("[PDF Generator] Creating PDF")

    report = IntelligenceReport.model_validate(
        state["report"]
    )

    pdf_path = generate_pdf(report)

    print(
        "[PDF Generator] Saved:",
        pdf_path,
    )

    return {
        "pdf_path": str(pdf_path),
        "status": "completed",
    }


# =========================================================
# 7. FAILURE NODE
# =========================================================

async def failed_node(
    state: IntelState,
) -> dict:
    """
    Marks the workflow as failed after
    retry limits are exceeded.
    """

    error = (
        state.get("validation_error")
        or state.get("verification")
        or "Unknown workflow failure."
    )

    print(
        "[LangGraph] Workflow failed:",
        error,
    )

    return {
        "status": "failed",
    }
