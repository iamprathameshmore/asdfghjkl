
# Stage 1: Build React
FROM node:22-alpine AS frontend-build

WORKDIR /frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build


# Stage 2: Install Python dependencies using Poetry
FROM python:3.12-slim AS python-build

ENV POETRY_VIRTUALENVS_CREATE=false \
    POETRY_NO_INTERACTION=1 \
    POETRY_CACHE_DIR=/tmp/poetry-cache

WORKDIR /app

RUN pip install --no-cache-dir "poetry==2.1.3"

COPY pyproject.toml poetry.lock ./
COPY backend/src ./backend/src

RUN poetry install --only main --no-root


# Stage 3: Final runtime
FROM python:3.12-slim AS runtime

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app/backend/src \
    PORT=8000

WORKDIR /app

COPY --from=python-build /usr/local /usr/local
COPY --from=python-build /app/backend/src ./backend/src
COPY --from=frontend-build /frontend/dist ./frontend/dist

EXPOSE 8000

CMD ["sh", "-c", "uvicorn wind_forecast.main:app --host 0.0.0.0 --port ${PORT}"]
