from datetime import date, datetime, time, timedelta
import math
from typing import Any

import pandas as pd

try:
    import numpy as np
except ImportError:  # pragma: no cover - pandas normally installs numpy
    np = None  # type: ignore[assignment]


def to_jsonable(value: Any) -> Any:
    """Convert pandas/numpy/datetime scalars to JSON-friendly values."""
    if value is None:
        return None

    if isinstance(value, pd.Timedelta):
        return None if pd.isna(value) else value.total_seconds()

    if isinstance(value, pd.Timestamp):
        return None if pd.isna(value) else value.isoformat()

    if isinstance(value, timedelta):
        return value.total_seconds()

    if isinstance(value, (datetime, date, time)):
        return value.isoformat()

    if np is not None:
        if isinstance(value, np.integer):
            return int(value)
        if isinstance(value, np.floating):
            return None if math.isnan(float(value)) else float(value)
        if isinstance(value, np.bool_):
            return bool(value)

    if isinstance(value, float) and math.isnan(value):
        return None

    try:
        if pd.isna(value):
            return None
    except (TypeError, ValueError):
        pass

    return value


def dataframe_to_records(df: pd.DataFrame, columns: list[str] | None = None) -> list[dict[str, Any]]:
    if columns is not None:
        existing_columns = [column for column in columns if column in df.columns]
        df = df.loc[:, existing_columns]

    return [
        {column: to_jsonable(value) for column, value in row.items()}
        for row in df.to_dict(orient="records")
    ]
