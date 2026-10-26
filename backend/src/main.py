
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from config.db import (
    check_database_connection,
    close_mongodb_connection,
    connect_to_mongodb,
)
from features.wind.controllers.wind_controller import router as wind_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).resolve().parents[2]
FRONTEND_DIST = PROJECT_ROOT / "frontend" / "dist"


@asynccontextmanager
async def lifespan(app: FastAPI):
    connect_to_mongodb()
    yield
    close_mongodb_connection()


app = FastAPI(
    title="Wind Forecast Portal API",
    version="1.0.0",
    description="Wind generation forecast accuracy analysis.",
    lifespan=lifespan,
)

# Optional for separate local frontend development.
# Production uses the same origin, so CORS is not required there.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(wind_router)


@app.get("/api/health")
def health_check():
    database_connected = check_database_connection()

    return JSONResponse(
        status_code=200 if database_connected else 503,
        content={
            "status": "ok" if database_connected else "degraded",
            "database": "connected" if database_connected else "disconnected",
        },
    )


@app.get("/api")
def api_info():
    return {
        "name": "Wind Forecast Portal API",
        "docs": "/docs",
        "health": "/api/health",
    }


if FRONTEND_DIST.exists():
    app.mount(
        "/",
        StaticFiles(directory=str(FRONTEND_DIST), html=True),
        name="frontend",
    )
else:
    logger.warning(
        "Frontend build not found at %s. API-only mode is active.",
        FRONTEND_DIST,
    )


if __name__ == "__main__":
    import os
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", "8000")),
    )
