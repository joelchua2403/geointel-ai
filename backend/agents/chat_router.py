
import os
from typing import Literal

from langchain_ollama import ChatOllama
from pydantic import BaseModel, Field


class ChatIntent(BaseModel):
    intent: Literal["chat", "generate_report"]
    query: str = Field(min_length=1)
    period_days: int = Field(default=7, ge=1, le=90)
    report_format: Literal["concise", "detailed"] = "detailed"


llm = ChatOllama(
    model=os.getenv("AGENT_MODEL", "qwen2.5:7b"),
    base_url=os.getenv(
        "OLLAMA_BASE_URL",
        "http://localhost:11434",
    ),
    temperature=0,
)

classifier = llm.with_structured_output(
    ChatIntent,
    method="json_schema",
)


async def classify_intent(
    message: str,
    conversation_context: str = "",
) -> ChatIntent:
    result = await classifier.ainvoke([
        (
            "system",
            """
You route messages for a geopolitical AI chatbot.

Choose "generate_report" when the user requests
a new intelligence report or PDF document.

Choose "chat" for normal questions, explanations,
summaries, and discussions.

Use previous conversation context to resolve
follow-ups such as "make that into a PDF".

For report requests:
- Extract the actual research topic.
- Extract the reporting period if specified.
- Default to 7 days when unspecified.
- Choose concise or detailed format.

Never invent a research topic.
Return structured data matching the schema.
"""
        ),
        (
            "human",
            f"Conversation:\n{conversation_context}\n\n"
            f"Latest message:\n{message}"
        ),
    ])

    if result is None:
        raise ValueError("Intent classification returned no result")

    return ChatIntent.model_validate(result)
