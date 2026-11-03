
from langgraph.graph import (
    StateGraph,
    START,
    END,
)

from .state import IntelState

from .nodes import (
    research_agent,
    analysis_agent,
    verification_agent,
    report_writer_agent,
    validate_report_node,
    pdf_generator_node,
    failed_node,
)


# ----------------------------------
# Configuration
# ----------------------------------

MAX_RESEARCH_RETRIES = 2
MAX_REPORT_RETRIES = 2


# ----------------------------------
# Conditional routing
# ----------------------------------

def route_verification(state: IntelState):
    """
    Retry research when verification fails.
    """

    if state.get("verified", False):
        return "report_writer"

    if (
        state.get("research_retries", 0)
        < MAX_RESEARCH_RETRIES
    ):
        return "research"

    return "failed"


def route_report_validation(state: IntelState):
    """
    Retry report writing if invalid.
    """

    if state.get("report_valid", False):
        return "validate_report"

    if (
        state.get("report_retries", 0)
        < MAX_REPORT_RETRIES
    ):
        return "report_writer"

    return "failed"


def route_final_validation(state: IntelState):
    """
    Generate PDF only when Pydantic
    validation succeeds.
    """

    if state.get("report_valid", False):
        return "pdf_generator"

    if (
        state.get("report_retries", 0)
        < MAX_REPORT_RETRIES
    ):
        return "report_writer"

    return "failed"


# ----------------------------------
# Build LangGraph
# ----------------------------------

builder = StateGraph(IntelState)

# Register nodes
builder.add_node("research", research_agent)
builder.add_node("analysis", analysis_agent)
builder.add_node("verification", verification_agent)
builder.add_node("report_writer", report_writer_agent)
builder.add_node("validate_report", validate_report_node)
builder.add_node("pdf_generator", pdf_generator_node)
builder.add_node("failed", failed_node)


# Entry point
builder.add_edge(START, "research")


# Research -> Analysis -> Verification
builder.add_edge("research", "analysis")
builder.add_edge("analysis", "verification")


# Verification conditional routing
builder.add_conditional_edges(
    "verification",
    route_verification,
    {
        "research": "research",
        "report_writer": "report_writer",
        "failed": "failed",
    },
)


# Report writing conditional routing
builder.add_conditional_edges(
    "report_writer",
    route_report_validation,
    {
        "validate_report": "validate_report",
        "report_writer": "report_writer",
        "failed": "failed",
    },
)


# Pydantic validation routing
builder.add_conditional_edges(
    "validate_report",
    route_final_validation,
    {
        "pdf_generator": "pdf_generator",
        "report_writer": "report_writer",
        "failed": "failed",
    },
)


# End states
builder.add_edge("pdf_generator", END)
builder.add_edge("failed", END)


# Compile graph
intel_graph = builder.compile()
