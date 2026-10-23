import asyncio
import hmac
import logging
import os
from functools import lru_cache
from time import perf_counter
from uuid import uuid4

from fastapi import Depends, FastAPI, Header, HTTPException
from opentelemetry import trace

from .agent import run_agent
from .schemas import CoachRequest, CoachResponse

logger = logging.getLogger("metriful.coach")
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(levelname)s %(message)s"))
    logger.addHandler(handler)
logger.setLevel(logging.INFO)
logger.propagate = False
app = FastAPI(title="Metriful Coach", docs_url=None, redoc_url=None, openapi_url=None)
slots = asyncio.Semaphore(8)


def authorize(x_agent_key: str = Header(default="")):
    expected = os.getenv("AGENT_INTERNAL_KEY", "")
    if len(expected) < 32:
        raise HTTPException(503, "Coach is not configured")
    if not hmac.compare_digest(x_agent_key.encode(), expected.encode()):
        raise HTTPException(401, "Authentication required")


@lru_cache(maxsize=1)
def get_model():
    from langchain_google_genai import ChatGoogleGenerativeAI
    key = os.getenv("GEMINI_API_KEY")
    if not key:
        raise HTTPException(503, "Coach model is not configured")
    model = os.getenv("AGENT_MODEL", "gemini-3.8-flash")
    thinking = {"thinking_budget": 0} if model.startswith("gemini-2.5-flash") else {"thinking_level": "low"}
    endpoint = {"base_url": os.environ["AGENT_API_BASE_URL"]} if os.getenv("AGENT_API_BASE_URL") else {}
    return ChatGoogleGenerativeAI(model=model, api_key=key, temperature=1,
                                 max_output_tokens=2048, timeout=12, max_retries=0, **thinking, **endpoint)


@app.get("/healthz")
def healthz():
    return {"status": "ok"}


@app.post("/v1/coach/runs", response_model=CoachResponse, dependencies=[Depends(authorize)])
async def coach(request: CoachRequest, model=Depends(get_model)):
    if slots.locked():
        raise HTTPException(429, "Coach is busy; retry shortly")
    run_id, started = str(uuid4()), perf_counter()
    try:
        async with slots:
            # No prompts, tool payloads, health values, account IDs or exception text in telemetry.
            with trace.get_tracer("metriful.coach").start_as_current_span(
                    "coach.run", record_exception=False, set_status_on_exception=False) as span:
                span.set_attribute("run.id", run_id)
                async with asyncio.timeout(22):
                    response = await run_agent(request, model, run_id)
                span.set_attribute("tool.count", len(response.tools))
                return response
    except Exception:
        logger.warning("coach_failed run_id=%s", run_id)
        raise HTTPException(503, "Coach could not complete this request") from None
    finally:
        logger.info("coach_run run_id=%s duration_ms=%d", run_id,
                    int((perf_counter() - started) * 1000))


def configure_telemetry():
    # Export only our explicit spans. Do not enable HTTP/LLM auto-instrumentation.
    if os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT"):
        from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
        from opentelemetry.sdk.resources import Resource
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor
        provider = TracerProvider(resource=Resource.create({"service.name": "metriful-agent"}))
        provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter()))
        trace.set_tracer_provider(provider)


configure_telemetry()
