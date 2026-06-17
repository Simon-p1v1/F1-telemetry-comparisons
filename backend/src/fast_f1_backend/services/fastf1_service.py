from functools import lru_cache
from pathlib import Path
from typing import Any

from fast_f1_backend.config import settings
from fast_f1_backend.serializers import dataframe_to_records


SCHEDULE_COLUMNS = [
    "RoundNumber",
    "Country",
    "Location",
    "OfficialEventName",
    "EventName",
    "EventDate",
    "Session1",
    "Session1Date",
    "Session2",
    "Session2Date",
    "Session3",
    "Session3Date",
    "Session4",
    "Session4Date",
    "Session5",
    "Session5Date",
]

LAP_COLUMNS = [
    "Driver",
    "Team",
    "LapNumber",
    "Position",
    "LapTime",
    "Sector1Time",
    "Sector2Time",
    "Sector3Time",
    "Compound",
    "TyreLife",
    "Stint",
    "PitInTime",
    "PitOutTime",
    "IsAccurate",
]

RESULT_COLUMNS = [
    "Position",
    "ClassifiedPosition",
    "DriverNumber",
    "BroadcastName",
    "Abbreviation",
    "DriverId",
    "TeamName",
    "GridPosition",
    "Status",
    "Points",
    "Time",
]

WEATHER_COLUMNS = [
    "Time",
    "AirTemp",
    "Humidity",
    "Pressure",
    "Rainfall",
    "TrackTemp",
    "WindDirection",
    "WindSpeed",
]

TELEMETRY_COLUMNS = [
    "Date",
    "Time",
    "SessionTime",
    "Distance",
    "RPM",
    "Speed",
    "nGear",
    "Throttle",
    "Brake",
    "DRS",
    "X",
    "Y",
]

CORNER_COLUMNS = [
    "Number",
    "Letter",
    "Distance",
]

TRACK_STATUS_COLUMNS = [
    "Time",
    "Status",
    "Message",
]


def _import_fastf1() -> Any:
    import fastf1

    return fastf1


def _enable_cache(cache_dir: Path) -> None:
    cache_dir.mkdir(parents=True, exist_ok=True)
    _import_fastf1().Cache.enable_cache(str(cache_dir))


@lru_cache(maxsize=settings.session_cache_size)
def _load_session(
    cache_dir: str,
    year: int,
    event: str,
    session_type: str,
    telemetry: bool,
    weather: bool,
    messages: bool,
) -> Any:
    cache_path = Path(cache_dir)
    _enable_cache(cache_path)

    fastf1 = _import_fastf1()
    event_identifier: str | int = int(event) if event.isdigit() else event
    session = fastf1.get_session(year, event_identifier, session_type.upper())
    session.load(telemetry=telemetry, weather=weather, messages=messages)
    return session


class FastF1Service:
    """Small wrapper around Fast-F1 that keeps API handlers thin and extendable."""

    def __init__(self, cache_dir: Path = settings.cache_dir) -> None:
        self.cache_dir = cache_dir

    def schedule(self, year: int) -> list[dict[str, Any]]:
        _enable_cache(self.cache_dir)
        fastf1 = _import_fastf1()

        try:
            schedule = fastf1.get_event_schedule(year, include_testing=False)
        except TypeError:
            schedule = fastf1.get_event_schedule(year)

        return dataframe_to_records(schedule, SCHEDULE_COLUMNS)

    def laps(
        self,
        year: int,
        event: str,
        session_type: str,
        driver: str | None = None,
    ) -> list[dict[str, Any]]:
        session = self._session(year, event, session_type)
        laps = session.laps.copy()

        if driver:
            laps = laps[laps["Driver"].astype(str).str.upper() == driver.upper()]

        if "LapNumber" in laps.columns:
            laps = laps.sort_values(["Driver", "LapNumber"])

        return dataframe_to_records(laps, LAP_COLUMNS)

    def results(self, year: int, event: str, session_type: str) -> list[dict[str, Any]]:
        session = self._session(year, event, session_type)
        return dataframe_to_records(session.results.copy(), RESULT_COLUMNS)

    def weather(self, year: int, event: str, session_type: str) -> list[dict[str, Any]]:
        session = self._session(year, event, session_type, weather=True)
        return dataframe_to_records(session.weather_data.copy(), WEATHER_COLUMNS)

    def telemetry(
        self,
        year: int,
        event: str,
        session_type: str,
        driver: str,
        lap_number: int,
    ) -> list[dict[str, Any]]:
        session = self._session(year, event, session_type, telemetry=True)
        driver_laps = session.laps[session.laps["Driver"].astype(str).str.upper() == driver.upper()]
        lap_matches = driver_laps[driver_laps["LapNumber"] == lap_number]

        if lap_matches.empty:
            raise ValueError(f"No lap {lap_number} found for driver {driver.upper()}.")

        lap = lap_matches.iloc[0]
        try:
            telemetry = lap.get_telemetry().add_distance()
        except (KeyError, Exception):
            # Position data unavailable for this lap, fall back to car data only (no X/Y)
            telemetry = lap.get_car_data().add_distance()
        return dataframe_to_records(telemetry, TELEMETRY_COLUMNS)

    def corners(self, year: int, event: str, session_type: str) -> list[dict[str, Any]]:
        session = self._session(year, event, session_type, telemetry=True)
        try:
            circuit_info = session.get_circuit_info()
        except KeyError:
            # fastf1 fails to compute Distance when telemetry lacks a Date column
            session_no_tel = self._session(year, event, session_type, telemetry=False)
            circuit_info = session_no_tel.get_circuit_info()
        return dataframe_to_records(circuit_info.corners.copy(), CORNER_COLUMNS)

    def track_status(self, year: int, event: str, session_type: str) -> list[dict[str, Any]]:
        session = self._session(year, event, session_type, messages=True)
        return dataframe_to_records(session.track_status.copy(), TRACK_STATUS_COLUMNS)

    def _session(
        self,
        year: int,
        event: str,
        session_type: str,
        telemetry: bool = False,
        weather: bool = False,
        messages: bool = False,
    ) -> Any:
        return _load_session(
            str(self.cache_dir),
            year,
            event,
            session_type,
            telemetry,
            weather,
            messages,
        )
