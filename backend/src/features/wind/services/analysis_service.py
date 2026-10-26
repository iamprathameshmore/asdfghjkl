
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

import pandas as pd
from pymongo.database import Database

from src.config.constants import Collections

LONDON = ZoneInfo("Europe/London")
UTC = timezone.utc


def _as_utc(value: datetime) -> datetime:
    """Normalize a datetime to timezone-aware UTC."""
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def _decision_cutoff(
    delivery_start: datetime,
    cutoff_hour: int,
    cutoff_minute: int,
) -> datetime:
    """Return the previous local calendar day's decision cutoff."""
    local_delivery = _as_utc(delivery_start).astimezone(LONDON)
    previous_day = local_delivery.date() - timedelta(days=1)

    local_cutoff = datetime.combine(
        previous_day,
        time(hour=cutoff_hour, minute=cutoff_minute),
        tzinfo=LONDON,
    )
    return local_cutoff.astimezone(UTC)


def analyse_wind(
    database: Database,
    start_date: date,
    end_date: date,
    cutoff_hour: int = 9,
    cutoff_minute: int = 0,
) -> dict:
    """
    Analyse delivery intervals in [start_date, end_date).

    For each interval, select the latest forecast vintage whose
    publish_time is at or before that interval's decision cutoff.
    """
    start_utc = datetime.combine(start_date, time.min, tzinfo=LONDON).astimezone(UTC)
    end_utc = datetime.combine(end_date, time.min, tzinfo=LONDON).astimezone(UTC)

    actuals = list(
        database[Collections.ACTUAL_GENERATION].find(
            {"start_time": {"$gte": start_utc, "$lt": end_utc}},
            {"_id": 0, "start_time": 1, "generation_mw": 1},
        ).sort("start_time", 1)
    )

    # Forecasts are read across the analysis delivery window. Historical
    # forecast vintages must be retained to support cutoff-based selection.
    forecasts = list(
        database[Collections.WIND_FORECAST].find(
            {"start_time": {"$gte": start_utc, "$lt": end_utc}},
            {
                "_id": 0,
                "start_time": 1,
                "publish_time": 1,
                "generation_mw": 1,
            },
        ).sort([("start_time", 1), ("publish_time", 1)])
    )

    actual_by_start = {
        _as_utc(row["start_time"]): float(row["generation_mw"])
        for row in actuals
    }

    forecasts_by_start: dict[datetime, list[dict]] = {}
    for row in forecasts:
        delivery_start = _as_utc(row["start_time"])
        forecasts_by_start.setdefault(delivery_start, []).append(row)

    all_starts = sorted(set(actual_by_start) | set(forecasts_by_start))
    rows = []

    for delivery_start in all_starts:
        cutoff = _decision_cutoff(
            delivery_start,
            cutoff_hour=cutoff_hour,
            cutoff_minute=cutoff_minute,
        )

        eligible = [
            forecast
            for forecast in forecasts_by_start.get(delivery_start, [])
            if _as_utc(forecast["publish_time"]) <= cutoff
        ]

        selected = max(
            eligible,
            key=lambda row: _as_utc(row["publish_time"]),
            default=None,
        )

        actual = actual_by_start.get(delivery_start)
        forecast_value = (
            float(selected["generation_mw"]) if selected is not None else None
        )

        error = (
            forecast_value - actual
            if forecast_value is not None and actual is not None
            else None
        )

        rows.append(
            {
                "start_time": delivery_start.isoformat(),
                "actual_generation_mw": actual,
                "forecast_generation_mw": forecast_value,
                "forecast_publish_time": (
                    _as_utc(selected["publish_time"]).isoformat()
                    if selected is not None
                    else None
                ),
                "decision_cutoff": cutoff.isoformat(),
                "forecast_error_mw": error,
                "absolute_error_mw": abs(error) if error is not None else None,
            }
        )

    errors = [
        row["forecast_error_mw"]
        for row in rows
        if row["forecast_error_mw"] is not None
    ]

    mae = sum(abs(error) for error in errors) / len(errors) if errors else None
    rmse = (
        (sum(error * error for error in errors) / len(errors)) ** 0.5
        if errors
        else None
    )
    bias = sum(errors) / len(errors) if errors else None

    matched = len(errors)
    return {
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "decision_cutoff": (
            f"Previous delivery day at {cutoff_hour:02d}:{cutoff_minute:02d} "
            "Europe/London"
        ),
        "metrics": {
            "total_intervals": len(rows),
            "matched_intervals": matched,
            "missing_actual_intervals": sum(
                row["actual_generation_mw"] is None for row in rows
            ),
            "missing_forecast_intervals": sum(
                row["forecast_generation_mw"] is None for row in rows
            ),
            "mae_mw": mae,
            "rmse_mw": rmse,
            "bias_mw": bias,
        },
        "readings": rows,
    }
