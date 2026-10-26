
from enum import StrEnum


class Collections(StrEnum):
    ACTUAL_GENERATION = "actual_generation"
    WIND_FORECAST = "wind_forecast"
    SYNC_RUN = "sync_run"


class FuelType(StrEnum):
    WIND = "WIND"


class SyncStatus(StrEnum):
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class DatasetType(StrEnum):
    FUELHH = "FUELHH"
    WINDFOR = "WINDFOR"


ELEXON_BASE_URL = "https://data.elexon.co.uk/bmrs/api/v1"

DEFAULT_START_DATE = "2026-01-01"
DEFAULT_END_DATE = "2026-02-01"

# A forecast must have been published on or before this cutoff
# to be eligible for the relevant purchase decision.
DEFAULT_DECISION_CUTOFF_HOUR = 9
DEFAULT_DECISION_CUTOFF_MINUTE = 0

API_PREFIX = "/api"
API_VERSION = "v1"
