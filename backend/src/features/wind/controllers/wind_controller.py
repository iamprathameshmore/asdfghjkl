
from datetime import date

from fastapi import APIRouter, HTTPException, Query
from pymongo.errors import PyMongoError

from config.db import get_database
from features.wind.services.analysis_service import analyse_wind

router = APIRouter(prefix="/api/v1/wind", tags=["Wind"])


@router.get("/analysis")
def get_wind_analysis(
    start_date: date = Query(default=date(2026, 1, 1)),
    end_date: date = Query(default=date(2026, 2, 1)),
    cutoff_hour: int = Query(default=9, ge=0, le=23),
    cutoff_minute: int = Query(default=0, ge=0, le=59),
):
    if start_date >= end_date:
        raise HTTPException(
            status_code=400,
            detail="start_date must be earlier than end_date",
        )

    try:
        return analyse_wind(
            database=get_database(),
            start_date=start_date,
            end_date=end_date,
            cutoff_hour=cutoff_hour,
            cutoff_minute=cutoff_minute,
        )
    except (RuntimeError, PyMongoError):
        raise HTTPException(
            status_code=503,
            detail="Wind analysis is temporarily unavailable",
        ) from None


@router.get("/readings")
def get_wind_readings(
    start_date: date = Query(default=date(2026, 1, 1)),
    end_date: date = Query(default=date(2026, 2, 1)),
    cutoff_hour: int = Query(default=9, ge=0, le=23),
    cutoff_minute: int = Query(default=0, ge=0, le=59),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=500),
):
    if start_date >= end_date:
        raise HTTPException(
            status_code=400,
            detail="start_date must be earlier than end_date",
        )

    try:
        result = analyse_wind(
            database=get_database(),
            start_date=start_date,
            end_date=end_date,
            cutoff_hour=cutoff_hour,
            cutoff_minute=cutoff_minute,
        )
    except (RuntimeError, PyMongoError):
        raise HTTPException(
            status_code=503,
            detail="Wind readings are temporarily unavailable",
        ) from None

    all_readings = result["readings"]
    total = len(all_readings)
    offset = (page - 1) * page_size

    return {
        "page": page,
        "page_size": page_size,
        "total": total,
        "items": all_readings[offset : offset + page_size],
    }
