import os
import json
import requests

from langchain.agents import create_agent
from langchain.tools import tool
from langchain_ollama import ChatOllama

# ==========================================
# CONFIGURATION
# ==========================================

GEOINTEL_API_URL = os.getenv(
    "GEOINTEL_API_URL",
    "http://127.0.0.1:8000"
)

OLLAMA_URL = os.getenv(
    "OLLAMA_URL",
    "http://127.0.0.1:11434"
)

MODEL_NAME = "llama3.2:1b"

# ==========================================
# TOOLS
# ==========================================


import re
import json
import requests

@tool
def get_recent_developments(topic: str = "") -> str:
    """Retrieve recent geopolitical news, optionally filtered by topic.

    Args:
        topic: Country or geopolitical topic, e.g. China, US, Taiwan.
    """
    try:
        response = requests.get(
            f"{GEOINTEL_API_URL}/api/articles",
            timeout=30
        )
        response.raise_for_status()

        data = response.json()
        articles = (
            data if isinstance(data, list)
            else data.get("articles", [])
        )

        if topic.strip():
            keywords = re.findall(r"\b\w+\b", topic.lower())

            filtered = []

            for article in articles:
                text = " ".join([
                    str(article.get("title") or ""),
                    str(article.get("summary") or ""),
                    str(article.get("country") or "")
                ])

                words = set(
                    re.findall(r"\b\w+\b", text.lower())
                )

                if any(keyword in words for keyword in keywords):
                    filtered.append(article)

            articles = filtered

        articles = articles[:5]

        return json.dumps(
            [
                {
                    "title": a.get("title", ""),
                    "summary": a.get("summary", ""),
                    "source": a.get("source", ""),
                    "url": a.get("url", ""),
                    "published_at": a.get("published_at", "")
                }
                for a in articles
            ],
            ensure_ascii=False
        )

    except requests.RequestException as exc:
        return f"News retrieval failed: {exc}"

    
    
@tool
def search_intelligence(question: str) -> str:
    """Search indexed geopolitical intelligence articles using semantic RAG retrieval."""
    try:
        response = requests.post(
            f"{GEOINTEL_API_URL}/api/rag/query",
            json={
                "question": question,
                "limit": 5
            },
            timeout=120
        )

        response.raise_for_status()

        data = response.json()

        return json.dumps(
            data,
            ensure_ascii=False,
            default=str
        )

    except requests.exceptions.RequestException as exc:
        return f"ERROR: RAG search failed: {exc}"
    except ValueError:
        return "ERROR: Invalid JSON from RAG endpoint."

# ==========================================
# LLM
# ==========================================

llm = ChatOllama(
    model=MODEL_NAME,
    base_url=OLLAMA_URL,
    temperature=0,
)


# ==========================================
# SYSTEM PROMPT
# ==========================================

system_prompt = """
You are GeoIntel AI.

Use tools to retrieve news before answering.

Only report information explicitly present in
the retrieved article titles or summaries.

Never add events, sanctions, tariffs, or policies
that are not mentioned in the retrieved evidence.

Summarize at most two developments.

For each development:
- State what the headline reports.
- Provide the exact source URL.
- Do not invent additional details.

If no relevant evidence exists, say so.
"""

# ==========================================
# CREATE AGENT
# ==========================================

agent = create_agent(
    model=llm,
    tools=[
        get_recent_developments,
        search_intelligence
    ],
    system_prompt=system_prompt,
)


# ==========================================
# RUN AGENT
# ==========================================

def run_agent(question: str):
    print("\n" + "=" * 60)
    print("GEOINTEL AI AGENT")
    print("=" * 60)

    print(f"\nUSER: {question}")

    try:
        result = agent.invoke(
            {
                "messages": [
                    {
                        "role": "user",
                        "content": question
                    }
                ]
            },
            config={
                "recursion_limit": 10
            }
        )

        print("\n" + "=" * 60)
        print("AGENT EXECUTION TRACE")
        print("=" * 60)

        for message in result["messages"]:

            message_type = type(message).__name__

            if message_type == "HumanMessage":
                continue

            if message_type == "AIMessage":

                if message.tool_calls:
                    for call in message.tool_calls:
                        print(
                            f"\n[TOOL CALL] {call['name']}"
                        )
                        print(
                            f"Arguments: {call['args']}"
                        )

                elif message.content:
                    print(
                        f"\n[AI RESPONSE]\n{message.content}"
                    )

            elif message_type == "ToolMessage":
                print(
                    f"\n[TOOL RESULT]\n{message.content}"
                )

        print("\n" + "=" * 60)

        final_message = result["messages"][-1]

        print("\nFINAL ANSWER:")
        print(final_message.content)

        return final_message.content

    except Exception as exc:
        print(
            f"\nAgent execution failed: "
            f"{type(exc).__name__}: {exc}"
        )
        return None


# ==========================================
# ENTRY POINT
# ==========================================

if __name__ == "__main__":

    print("GeoIntel AI Agent")
    print(f"Model: {MODEL_NAME}")
    print(f"Ollama: {OLLAMA_URL}")
    print(f"Backend: {GEOINTEL_API_URL}")

    while True:
        question = input(
            "\nAsk GeoIntel AI (or type 'exit'): "
        ).strip()

        if question.lower() in ("exit", "quit"):
            print("Goodbye!")
            break

        if not question:
            continue

        run_agent(question)
