from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Path, Query

from fast_f1_backend.services.fastf1_service import FastF1Service


router = APIRouter()
_service = FastF1Service()

COMMON_ERROR_RESPONSES = {
    404: {"description": "Requested driver/lap data was not found in the loaded session."},
    422: {"description": "Invalid path or query parameter."},
    502: {
        "description": (
            "Fast-F1 or one of its upstream data providers failed, timed out, "
            "or returned unavailable data. Try again after the cache is warm."
        )
    },
}

YearPath = Annotated[int, Path(ge=1950, description="F1 season year. Historical data is broad; telemetry is mostly useful from 2018 onward.", examples=[2023])]
EventPath = Annotated[
    str,
    Path(
        description=(
            "Grand Prix/event identifier accepted by Fast-F1. Use common names such as "
            "'Azerbaijan', 'Monaco', 'British Grand Prix', or a round number like '4'. "
            "URL-encode spaces when calling manually."
        ),
        examples=["Azerbaijan"],
    ),
]
SessionTypePath = Annotated[
    str,
    Path(
        description=(
            "Session code. Common values: FP1, FP2, FP3, Q, SQ, S, R. "
            "R means race, Q means qualifying, S means sprint."
        ),
        examples=["R"],
    ),
]
DriverCodePath = Annotated[
    str,
    Path(
        min_length=2,
        max_length=3,
        description="Driver abbreviation/code, usually the three-letter timing code, e.g. VER, HAM, LEC.",
        examples=["VER"],
    ),
]


def get_service() -> FastF1Service:
    return _service


def _service_error(error: Exception) -> HTTPException:
    if isinstance(error, ValueError):
        return HTTPException(status_code=404, detail=str(error))
    return HTTPException(status_code=502, detail=f"Fast-F1 request failed: {error}")


@router.get(
    "/",
    tags=["system"],
    summary="Show API entrypoint information",
    description="Returns a small index with documentation links and the main endpoint patterns.",
    response_description="API entrypoint information.",
)
def root() -> dict[str, Any]:
    return {
        "name": "Fast-F1 Backend",
        "docs": "/docs",
        "openapi": "/openapi.json",
        "health": "/health",
        "endpoints": [
            "/events/{year}",
            "/sessions/{year}/{event}/{session_type}/laps",
            "/sessions/{year}/{event}/{session_type}/results",
            "/sessions/{year}/{event}/{session_type}/weather",
            "/sessions/{year}/{event}/{session_type}/telemetry/{driver}/{lap_number}",
        ],
    }


@router.get(
    "/health",
    tags=["system"],
    summary="Check that the API process is alive",
    description=(
        "Lightweight health endpoint. It does not call Fast-F1 or upstream F1 data providers, "
        "so it should respond quickly even when external data sources are unavailable."
    ),
    response_description="API status.",
)
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get(
    "/events/{year}",
    tags=["events"],
    summary="List season events and session dates",
    description=(
        "Returns the Fast-F1 event schedule for a season. This is useful for building frontend "
        "selectors before requesting session-specific metrics. Response records include round, "
        "country, location, event name, and known session dates."
    ),
    response_description="Season schedule records.",
    responses=COMMON_ERROR_RESPONSES,
)
def events(
    year: YearPath,
    service: Annotated[FastF1Service, Depends(get_service)],
) -> list[dict[str, Any]]:
    try:
        return service.schedule(year)
    except Exception as error:  # Fast-F1 depends on remote data providers.
        raise _service_error(error) from error


@router.get(
    "/sessions/{year}/{event}/{session_type}/laps",
    tags=["sessions"],
    summary="Get lap timing, sectors, tyres, and stint data",
    description=(
        "Loads a session without full telemetry and returns frontend-friendly lap records. "
        "Use this endpoint for lap time evolution, driver pace, sector comparison, tyre compound "
        "usage, stint length, and pit window visualizations. Add `driver=VER` to limit results "
        "to a single driver and reduce payload size. Lap/time fields are serialized as seconds "
        "or ISO-compatible values where possible."
    ),
    response_description="Lap records for all drivers or one filtered driver.",
    responses=COMMON_ERROR_RESPONSES,
)
def laps(
    year: YearPath,
    event: EventPath,
    session_type: SessionTypePath,
    service: Annotated[FastF1Service, Depends(get_service)],
    driver: Annotated[
        str | None,
        Query(
            min_length=2,
            max_length=3,
            description="Optional three-letter driver code to reduce the response, e.g. VER, HAM, LEC.",
            examples=["VER"],
        ),
    ] = None,
) -> list[dict[str, Any]]:
    try:
        return service.laps(year, event, session_type, driver)
    except Exception as error:
        raise _service_error(error) from error


@router.get(
    "/sessions/{year}/{event}/{session_type}/results",
    tags=["sessions"],
    summary="Get session classification/results",
    description=(
        "Returns the classification table for the selected session. Use this for race result cards, "
        "qualifying order, points summaries, grid/status views, and driver/team labels."
    ),
    response_description="Classification/result records.",
    responses=COMMON_ERROR_RESPONSES,
)
def results(
    year: YearPath,
    event: EventPath,
    session_type: SessionTypePath,
    service: Annotated[FastF1Service, Depends(get_service)],
) -> list[dict[str, Any]]:
    try:
        return service.results(year, event, session_type)
    except Exception as error:
        raise _service_error(error) from error


@router.get(
    "/sessions/{year}/{event}/{session_type}/weather",
    tags=["sessions"],
    summary="Get session weather samples",
    description=(
        "Returns sampled weather data for the selected session: air temperature, track temperature, "
        "humidity, pressure, rainfall, wind direction, and wind speed. Use this to explain pace "
        "changes, tyre degradation, wet/dry transitions, and safety-car context."
    ),
    response_description="Weather sample records.",
    responses=COMMON_ERROR_RESPONSES,
)
def weather(
    year: YearPath,
    event: EventPath,
    session_type: SessionTypePath,
    service: Annotated[FastF1Service, Depends(get_service)],
) -> list[dict[str, Any]]:
    try:
        return service.weather(year, event, session_type)
    except Exception as error:
        raise _service_error(error) from error


@router.get(
    "/sessions/{year}/{event}/{session_type}/corners",
    tags=["sessions"],
    summary="Get track corner positions",
    description="Returns corner numbers, letters, and distances for the circuit layout.",
    response_description="Corner records.",
    responses=COMMON_ERROR_RESPONSES,
)
def corners(
    year: YearPath,
    event: EventPath,
    session_type: SessionTypePath,
    service: Annotated[FastF1Service, Depends(get_service)],
) -> list[dict[str, Any]]:
    try:
        return service.corners(year, event, session_type)
    except Exception as error:
        raise _service_error(error) from error


@router.get(
    "/sessions/{year}/{event}/{session_type}/track_status",
    tags=["sessions"],
    summary="Get track status messages",
    description="Returns safety car, virtual safety car, red flag, and other track status events.",
    response_description="Track status records.",
    responses=COMMON_ERROR_RESPONSES,
)
def track_status(
    year: YearPath,
    event: EventPath,
    session_type: SessionTypePath,
    service: Annotated[FastF1Service, Depends(get_service)],
) -> list[dict[str, Any]]:
    try:
        return service.track_status(year, event, session_type)
    except Exception as error:
        raise _service_error(error) from error


@router.get(
    "/sessions/{year}/{event}/{session_type}/telemetry/{driver}/{lap_number}",
    tags=["telemetry"],
    summary="Get telemetry for one driver's one lap",
    description=(
        "Loads telemetry for a single driver and lap. This endpoint is intentionally filtered because "
        "telemetry payloads are large. Returned samples include distance, speed, throttle, brake, RPM, "
        "gear, and DRS when available. Best for detailed lap overlays and corner-by-corner analysis. "
        "Modern telemetry is mostly available from 2018 onward."
    ),
    response_description="Telemetry samples for one lap.",
    responses=COMMON_ERROR_RESPONSES,
)
def telemetry(
    year: Annotated[int, Path(ge=2018, description="Season year. Telemetry is mostly available from 2018 onward.", examples=[2023])],
    event: EventPath,
    session_type: SessionTypePath,
    driver: DriverCodePath,
    lap_number: Annotated[int, Path(ge=1, description="Lap number for this driver within the selected session.", examples=[12])],
    service: Annotated[FastF1Service, Depends(get_service)],
) -> list[dict[str, Any]]:
    try:
        return service.telemetry(year, event, session_type, driver, lap_number)
    except Exception as error:
        raise _service_error(error) from error
