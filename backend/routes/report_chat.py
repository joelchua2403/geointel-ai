
import asyncio
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from fastapi import WebSocket, WebSocketDisconnect
from agents.chat_router import classify_intent
from agents.graph import intel_graph
from agents.report_progress import progress_manager
NODE_LABELS = {
    "research_agent": "Research Agent",
    "analysis_agent": "Analysis Agent",
    "verification_agent": "Verification Agent",
    "report_writer_agent": "Report Writer",
    "validate_report_node": "Report Validation",
    "pdf_generator_node": "PDF Generator",
}

NODE_DESCRIPTIONS = {
    "research_agent": "Retrieving intelligence through MCP",
    "analysis_agent": "Analyzing geopolitical developments",
    "verification_agent": "Checking evidence and claims",
    "report_writer_agent": "Writing the intelligence report",
    "validate_report_node": "Validating report structure",
    "pdf_generator_node": "Creating the PDF document",
}


router = APIRouter(prefix="/api/chat", tags=["Report Chat"])

# Development-only in-memory job storage.
# Replace with persistent storage and a job worker
# before running multiple backend replicas.
jobs: dict[str, dict] = {}


class ChatRequest(BaseModel):
    message: str = Field(min_length=1)
    conversation_context: str = ""


async def run_report(job_id: str, query: str):
    jobs[job_id]["status"] = "running"

    progress_manager.publish(job_id, {
        "type": "job_status",
        "status": "running",
    })

    # Retain the last completed graph state.
    # Graph output can also be obtained from
    # a final graph state event.
    final_state = None

    try:
        async for event in intel_graph.astream_events(
            {
                "query": query,
                "research_retries": 0,
                "report_retries": 0,
                "status": "running",
            },
            version="v2",
            config={"recursion_limit": 30},
        ):
            event_type = event.get("event")
            node_name = event.get("name")
            metadata = event.get("metadata") or {}

            # Only emit events for top-level graph nodes.
            # This prevents nested LLM/tool events
            # from being mistaken for agent stages.
            is_graph_node = (
                metadata.get("langgraph_node") == node_name
                and node_name in NODE_LABELS
            )

            if is_graph_node and event_type == "on_chain_start":
                progress_manager.publish(job_id, {
                    "type": "node_progress",
                    "node": node_name,
                    "label": NODE_LABELS[node_name],
                    "status": "running",
                    "description": NODE_DESCRIPTIONS[node_name],
                })

            elif is_graph_node and event_type == "on_chain_end":
                progress_manager.publish(job_id, {
                    "type": "node_progress",
                    "node": node_name,
                    "label": NODE_LABELS[node_name],
                    "status": "completed",
                    "description": NODE_DESCRIPTIONS[node_name],
                })

            # Capture the final graph output.
            # The graph itself is normally named
            # LangGraph, but identifying the root
            # by empty parent_ids is more robust.
            if (
                event_type == "on_chain_end"
                and not event.get("parent_ids")
                and isinstance(event.get("data", {}).get("output"), dict)
            ):
                final_state = event["data"]["output"]

        if not final_state or final_state.get("status") != "completed":
            raise RuntimeError(
                "LangGraph did not complete successfully"
            )

        pdf_path = Path(final_state["pdf_path"]).resolve()

        if not pdf_path.is_file():
            raise FileNotFoundError("Generated PDF not found")

        jobs[job_id].update({
            "status": "completed",
            "pdf_path": str(pdf_path),
            "error": None,
        })

        progress_manager.publish(job_id, {
            "type": "job_status",
            "status": "completed",
            "download_url": (
                f"/api/chat/report-jobs/{job_id}/download"
            ),
        })

    except Exception as exc:
        # Log full details on the backend.
        import logging
        logging.exception(
            "Report generation failed for job %s",
            job_id,
        )

        jobs[job_id].update({
            "status": "failed",
            "error": "Report generation failed",
        })

        progress_manager.publish(job_id, {
            "type": "job_status",
            "status": "failed",
            "error": "Report generation failed",
        })


@router.post("/report-intent")
async def report_intent(request: ChatRequest):
    intent = await classify_intent(
        request.message,
        request.conversation_context,
    )

    if intent.intent == "chat":
        return {"type": "chat"}

    job_id = uuid4().hex

    jobs[job_id] = {
        "status": "queued",
        "pdf_path": None,
        "error": None,
    }

    research_query = (
        f"{intent.query}\n"
        f"Reporting period: last {intent.period_days} days.\n"
        f"Report format: {intent.report_format}."
    )

    asyncio.create_task(
        run_report(job_id, research_query)
    )

    return {
        "type": "report",
        "job_id": job_id,
        "message": "Generating your intelligence report.",
    }


@router.get("/report-jobs/{job_id}")
async def report_status(job_id: str):
    job = jobs.get(job_id)

    if job is None:
        raise HTTPException(404, "Job not found")

    return {
        "status": job["status"],
        "error": job["error"],
        "download_url": (
            f"/api/chat/report-jobs/{job_id}/download"
            if job["status"] == "completed"
            else None
        ),
    }


@router.get("/report-jobs/{job_id}/download")
async def download_report(job_id: str):
    from fastapi.responses import FileResponse

    job = jobs.get(job_id)

    if job is None or job["status"] != "completed":
        raise HTTPException(404, "Report not ready")

    filepath = Path(job["pdf_path"])

    if not filepath.is_file():
        raise HTTPException(404, "PDF file not found")

    return FileResponse(
        filepath,
        media_type="application/pdf",
        filename="geointel-intelligence-report.pdf",
    )

@router.websocket("/report-jobs/{job_id}/ws")
async def report_progress_ws(
    websocket: WebSocket,
    job_id: str,
):
    if job_id not in jobs:
        await websocket.close(code=1008)
        return

    # Add authentication and job ownership checks
    # here before accepting in production.
    await websocket.accept()

    queue, history = progress_manager.subscribe(job_id)

    try:
        # Replay events that occurred before connection.
        for event in history:
            await websocket.send_json(event)

        # If the job is already finished, history
        # contains the terminal status event.
        if jobs[job_id]["status"] in (
            "completed",
            "failed",
        ):
            return

        while True:
            event = await queue.get()
            await websocket.send_json(event)

            if (
                event.get("type") == "job_status"
                and event.get("status")
                in ("completed", "failed")
            ):
                break

    except WebSocketDisconnect:
        pass

    finally:
        progress_manager.unsubscribe(job_id, queue)