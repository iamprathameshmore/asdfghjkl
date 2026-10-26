
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ActualGenerationDocument(BaseModel):
    """One actual wind generation record per delivery interval."""

    model_config = ConfigDict(populate_by_name=True)

    start_time: datetime
    generation_mw: float
    fuel_type: Literal["WIND"] = "WIND"
    created_at: datetime
    updated_at: datetime


class WindForecastDocument(BaseModel):
    """One forecast vintage for a delivery interval."""

    model_config = ConfigDict(populate_by_name=True)

    start_time: datetime
    publish_time: datetime
    generation_mw: float
    created_at: datetime


class SyncRunDocument(BaseModel):
    """Audit record for an Elexon data ingestion run."""

    dataset: Literal["FUELHH", "WINDFOR"]
    start_date: datetime
    end_date: datetime
    status: Literal["RUNNING", "COMPLETED", "FAILED"]
    records_received: int = 0
    records_written: int = 0
    started_at: datetime
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None


class WindReadingResponse(BaseModel):
    start_time: datetime
    actual_generation_mw: Optional[float] = None
    forecast_generation_mw: Optional[float] = None
    forecast_publish_time: Optional[datetime] = None
    forecast_error_mw: Optional[float] = None
    absolute_error_mw: Optional[float] = None


class WindMetricsResponse(BaseModel):
    total_intervals: int
    matched_intervals: int
    missing_actual_intervals: int
    missing_forecast_intervals: int
    mae_mw: Optional[float] = None
    rmse_mw: Optional[float] = None
    bias_mw: Optional[float] = None


class WindAnalysisResponse(BaseModel):
    start_date: str
    end_date: str
    decision_cutoff: str
    metrics: WindMetricsResponse
    readings: list[WindReadingResponse] = Field(default_factory=list)


class WindReadingsResponse(BaseModel):
    total: int
    items: list[WindReadingResponse] = Field(default_factory=list)


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded"]
    database: Literal["connected", "disconnected"]
