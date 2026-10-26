
import logging
from typing import Optional

from pymongo import ASCENDING, DESCENDING, MongoClient
from pymongo.database import Database
from pymongo.errors import PyMongoError
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)


class DatabaseSettings(BaseSettings):
    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_database: str = "wind_forecast"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )


settings = DatabaseSettings()

_client: Optional[MongoClient] = None
_database: Optional[Database] = None


def connect_to_mongodb() -> None:
    """Connect to MongoDB and create required indexes."""
    global _client, _database

    if _client is not None and _database is not None:
        return

    client = MongoClient(
        settings.mongodb_uri,
        serverSelectionTimeoutMS=5000,
        tz_aware=True,
    )

    try:
        client.admin.command("ping")
        database = client[settings.mongodb_database]

        database["actual_generation"].create_index(
            [("start_time", ASCENDING)],
            unique=True,
            name="uq_actual_start_time",
        )

        database["wind_forecast"].create_index(
            [
                ("start_time", ASCENDING),
                ("publish_time", ASCENDING),
            ],
            unique=True,
            name="uq_forecast_delivery_publish",
        )

        database["wind_forecast"].create_index(
            [("publish_time", DESCENDING)],
            name="idx_forecast_publish_time",
        )

        database["sync_run"].create_index(
            [("started_at", DESCENDING)],
            name="idx_sync_started_at",
        )

        _client = client
        _database = database
        logger.info("Connected to MongoDB database '%s'", settings.mongodb_database)

    except Exception:
        client.close()
        logger.exception("Failed to connect to MongoDB or initialize indexes")
        raise


def get_database() -> Database:
    """Return the connected MongoDB database."""
    if _database is None:
        raise RuntimeError(
            "MongoDB is not connected. Check the application lifespan."
        )
    return _database


def close_mongodb_connection() -> None:
    """Close the MongoDB connection."""
    global _client, _database

    if _client is not None:
        _client.close()

    _client = None
    _database = None
    logger.info("MongoDB connection closed")


def check_database_connection() -> bool:
    """Check whether MongoDB is reachable."""
    try:
        get_database().command("ping")
        return True
    except (RuntimeError, PyMongoError):
        return False
