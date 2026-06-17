from datetime import timedelta

import pandas as pd

from fast_f1_backend.serializers import dataframe_to_records, to_jsonable


def test_to_jsonable_converts_timedelta_to_seconds() -> None:
    assert to_jsonable(timedelta(minutes=1, seconds=30)) == 90.0


def test_dataframe_to_records_converts_missing_values() -> None:
    df = pd.DataFrame([{"Driver": "VER", "LapTime": pd.NaT, "Speed": float("nan")}])

    assert dataframe_to_records(df) == [{"Driver": "VER", "LapTime": None, "Speed": None}]
