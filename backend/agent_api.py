"""GeoIntel AI chat endpoint. Include router in your existing FastAPI app."""
import asyncio
import os
import sys
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from langchain.agents import create_agent
from langchain_ollama import ChatOllama
from langchain_mcp_adapters.client import MultiServerMCPClient

router = APIRouter(prefix="/api/agent", tags=["GeoIntel Agent"])
_agent = None
_agent_lock = asyncio.Lock()


class ChatRequest(BaseModel):
    session_id: str = Field(min_length=1, max_length=128)
    message: str = Field(min_length=1, max_length=2000)


class ChatResponse(BaseModel):
    session_id: str
    answer: str


async def get_agent():
    global _agent
    if _agent is not None:
        return _agent
    async with _agent_lock:
        if _agent is not None:
            return _agent
        server = Path(__file__).resolve().with_name("mcp_server.py")
        if not server.exists():
            raise RuntimeError(f"Missing MCP server: {server}")
        client = MultiServerMCPClient({
            "geointel": {
                "transport": "stdio",
                "command": sys.executable,
                "args": [str(server)],
                "env": {
                    **os.environ,
                    "GEOINTEL_API_URL": os.getenv("GEOINTEL_API_URL", "http://127.0.0.1:8000"),
                },
            }
        })
        tools = await client.get_tools()
        llm = ChatOllama(
            model=os.getenv("AGENT_MODEL", "llama3.2:1b"),
            base_url=os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434"),
            temperature=0.1,
            num_ctx=4096,
            num_predict=350,
        )
        _agent = create_agent(
            model=llm,
            tools=tools,
            system_prompt=(
                "You are GeoIntel AI. Retrieve news evidence using tools before answering "
                "questions about current developments. Only report what retrieved titles or "
                "summaries support. Do not invent events or citations. Include source URLs "
                "when present. Say when evidence is insufficient."
            ),
        )
        return _agent


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    try:
        agent = await get_agent()
        result = await agent.ainvoke(
            {"messages": [{"role": "user", "content": request.message}]},
            config={"recursion_limit": 8},
        )
        answer = result["messages"][-1].content
        if not isinstance(answer, str):
            answer = str(answer)
        return ChatResponse(session_id=request.session_id, answer=answer)
    except Exception as exc:
        # Keep internal tool errors out of the public API response.
        import logging
        logging.exception("GeoIntel agent failed: %s", exc)
        raise HTTPException(status_code=503, detail="AI assistant temporarily unavailable") from exc
