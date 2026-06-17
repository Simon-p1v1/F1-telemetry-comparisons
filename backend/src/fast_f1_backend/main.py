from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from fast_f1_backend.api.routes import router
from fast_f1_backend.config import settings


logger = logging.getLogger("fast_f1_backend")

API_DESCRIPTION = """
Minimal JSON API for Formula 1 metrics powered by Fast-F1.

Use this backend as a thin data layer for a frontend visualization app:

1. Call `/events/{year}` to populate season/event selectors.
2. Call `/sessions/{year}/{event}/{session_type}/laps` for most charts.
3. Call `/results` and `/weather` for context around the session.
4. Call `/telemetry/{driver}/{lap_number}` only when the user requests a detailed lap view.

Fast-F1 downloads data from external F1 data providers and stores it in a local cache.
First requests can be slow; repeated requests should be much faster.
"""

OPENAPI_TAGS = [
    {
        "name": "system",
        "description": "Operational endpoints that do not require Fast-F1 upstream data.",
    },
    {
        "name": "events",
        "description": "Season schedule and event metadata used to drive frontend selectors.",
    },
    {
        "name": "sessions",
        "description": "Session-level metrics: laps, sectors, tyres, classifications, and weather.",
    },
    {
        "name": "telemetry",
        "description": "High-volume car telemetry. Endpoints are intentionally scoped by driver and lap.",
    },
]


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings.cache_dir.mkdir(parents=True, exist_ok=True)
    logger.info("Starting %s", settings.app_name)
    logger.info("Listening on http://%s:%s", settings.host_for_url, settings.port)
    logger.info("OpenAPI docs: http://%s:%s/docs", settings.host_for_url, settings.port)
    logger.info("Fast-F1 cache dir: %s", settings.cache_dir)
    yield
    logger.info("Stopping %s", settings.app_name)


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        summary="Formula 1 metrics API for frontend visualizations.",
        description=API_DESCRIPTION,
        version="0.1.0",
        lifespan=lifespan,
        openapi_tags=OPENAPI_TAGS,
        contact={"name": "Fast-F1 Backend maintainers"},
        license_info={"name": "Internal project"},
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(router)
    return app


app = create_app()


if __name__ == "__main__":
    from fast_f1_backend.runner import run

    run()
