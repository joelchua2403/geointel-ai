
import asyncio
import os
import sys
from pathlib import Path

from langchain.agents import create_agent
from langchain_ollama import ChatOllama
from langchain_mcp_adapters.client import MultiServerMCPClient


# ==========================================
# CONFIGURATION
# ==========================================

GEOINTEL_API_URL = os.getenv(
    "GEOINTEL_API_URL",
    "http://127.0.0.1:8000"
)

OLLAMA_URL = os.getenv(
    "OLLAMA_BASE_URL",
    "http://127.0.0.1:11434"
)

MODEL_NAME = "llama3.2:1b"

MCP_SERVER_PATH = (
    Path(__file__).resolve().parent / "mcp_server.py"
)


# ==========================================
# DISPLAY HELPERS
# ==========================================

def print_separator():
    print("\n" + "=" * 60)


def print_tool_result(result):
    """Display a shortened MCP tool result."""

    text = str(result)

    if len(text) > 3000:
        text = text[:3000] + "\n... [truncated]"

    print(text)


# ==========================================
# DIRECT MCP TOOL TESTS
# ==========================================

async def test_mcp_tools(tools):

    print_separator()
    print("TESTING MCP TOOLS")
    print_separator()

    tool_map = {
        tool.name: tool
        for tool in tools
    }

    # Test 1: Recent news
    if "get_recent_news" in tool_map:

        print("\n[TEST 1] get_recent_news")
        print("Topic: China")

        try:
            result = await tool_map[
                "get_recent_news"
            ].ainvoke({
                "topic": "China"
            })

            print("\n[RESULT]")
            print_tool_result(result)

        except Exception as exc:
            print(f"\n[ERROR] {exc}")

    # Test 2: RAG intelligence search
    if "search_intelligence" in tool_map:

        print("\n[TEST 2] search_intelligence")
        print("Question: US-China developments")

        try:
            result = await tool_map[
                "search_intelligence"
            ].ainvoke({
                "question": "What are recent US-China developments?"
            })

            print("\n[RESULT]")
            print_tool_result(result)

        except Exception as exc:
            print(f"\n[ERROR] {exc}")


# ==========================================
# LANGCHAIN MCP AGENT
# ==========================================

def build_agent(tools):

    llm = ChatOllama(
        model=MODEL_NAME,
        base_url=OLLAMA_URL,
        temperature=0.1,
        num_ctx=4096,
        num_predict=350,
    )

    system_prompt = """
You are GeoIntel AI, a geopolitical intelligence assistant.

You have access to MCP tools for retrieving geopolitical news
and searching indexed intelligence articles.

RULES:

1. Use the available tools to retrieve evidence before answering
   questions about current geopolitical developments.

2. Only report facts supported by retrieved evidence.

3. Never invent events, sanctions, tariffs, statements,
   organizations, or source attribution.

4. Include exact source URLs when available.

5. If retrieved evidence is insufficient, clearly state that.

6. Keep answers concise and factual.

7. Distinguish confirmed developments from possible implications.

8. Do not claim to have read full articles when only titles
   or summaries were retrieved.
"""

    return create_agent(
        model=llm,
        tools=tools,
        system_prompt=system_prompt,
    )


# ==========================================
# AGENT EXECUTION
# ==========================================

async def ask_agent(agent, question):

    print_separator()
    print("GEOINTEL AI MCP AGENT")
    print_separator()

    print(f"\nUSER: {question}")

    try:
        result = await agent.ainvoke({
            "messages": [
                {
                    "role": "user",
                    "content": question
                }
            ]
        })

        print_separator()
        print("AGENT EXECUTION TRACE")
        print_separator()

        for message in result["messages"]:

            message_type = getattr(
                message,
                "type",
                ""
            )

            if message_type == "ai":

                tool_calls = getattr(
                    message,
                    "tool_calls",
                    []
                )

                for call in tool_calls:

                    print(
                        f"\n[TOOL CALL] {call['name']}"
                    )

                    print(
                        f"Arguments: {call['args']}"
                    )

            elif message_type == "tool":

                print(
                    f"\n[TOOL RESULT] {message.name}"
                )

                print_tool_result(
                    message.content
                )

        print_separator()
        print("FINAL ANSWER")
        print_separator()

        final_message = result["messages"][-1]

        print(final_message.content)

    except Exception as exc:
        print(f"\n[AGENT ERROR] {exc}")


# ==========================================
# MAIN
# ==========================================

async def main():

    print_separator()
    print("GEOINTEL AI - MCP INTEGRATION")
    print_separator()

    print(f"Model: {MODEL_NAME}")
    print(f"Ollama: {OLLAMA_URL}")
    print(f"Backend: {GEOINTEL_API_URL}")
    print(f"MCP Server: {MCP_SERVER_PATH}")

    if not MCP_SERVER_PATH.exists():
        print("\nERROR: MCP server file not found.")
        return

    # Connect to MCP server
    client = MultiServerMCPClient({
        "geointel": {
            "transport": "stdio",
            "command": sys.executable,
            "args": [
                str(MCP_SERVER_PATH)
            ],
            "env": {
                **os.environ,
                "GEOINTEL_API_URL": GEOINTEL_API_URL,
            }
        }
    })

    # Discover tools
    tools = await client.get_tools()

    print("\nDiscovered MCP tools:")

    for tool in tools:
        print(f" - {tool.name}")

    if not tools:
        print("No MCP tools discovered.")
        return

    # Test MCP tools directly
    await test_mcp_tools(tools)

    # Build LangChain agent
    agent = build_agent(tools)

    print_separator()
    print("INTERACTIVE GEOINTEL AI AGENT")
    print_separator()

    print("\nType 'exit' to quit.")

    while True:

        question = await asyncio.to_thread(
            input,
            "\nAsk GeoIntel AI: "
        )

        if question.strip().lower() in {
            "exit",
            "quit"
        }:
            break

        if not question.strip():
            continue

        await ask_agent(
            agent,
            question
        )

    print("\nGeoIntel AI agent stopped.")


if __name__ == "__main__":
    asyncio.run(main())
