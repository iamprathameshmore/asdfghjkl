# Database Design — MongoDB Edition

## 1. Purpose

The database provides a local persistence and caching layer for Elexon data.

Elexon remains the authoritative source. MongoDB stores normalized actual-generation records, forecast vintages, and synchronization history. It must not unnecessarily duplicate calculated dashboard metrics.

- Database: MongoDB
- Python driver: PyMongo
- Configuration: Poetry + `pyproject.toml`
- Data access: Repository layer
- Migrations: No Alembic; MongoDB uses document structures and index management rather than relational schema migrations.

## 2. Collections

Use three collections:

- `actual_generation`
- `wind_forecast`
- `sync_run`

### 2.1 `actual_generation`

Stores actual wind-generation observations retrieved from Elexon `FUELHH`.

Example document:

```
{
  "_id": "ObjectId",
  "start_time": "2026-01-15T12:00:00Z",
  "generation_mw": 8432.5,
  "fuel_type": "WIND",
  "created_at": "2026-01-15T12:05:00Z",
  "updated_at": "2026-01-15T12:05:00Z"
}
```

In MongoDB, store timestamps as BSON `Date` values, not ISO-formatted strings. The JSON above illustrates the logical representation.

Indexes

```
db.actual_generation.createIndex(
  { start_time: 1 },
  { unique: true }
)
```

The application persists only `WIND` records for this challenge. The unique index ensures one document per delivery interval.

## 2.2 `wind_forecast`

Stores all relevant forecast vintages retrieved from Elexon `WINDFOR`.

Example document:

```
{
  "_id": "ObjectId",
  "start_time": "2026-01-15T12:00:00Z",
  "publish_time": "2026-01-14T10:30:00Z",
  "generation_mw": 8750.0,
  "created_at": "2026-01-14T10:35:00Z"
}
```

Again, store the timestamp fields as BSON `Date` values.

Unique constraint

```
db.wind_forecast.createIndex(
  { start_time: 1, publish_time: 1 },
  { unique: true }
)
```

This is essential because multiple forecasts can exist for the same delivery interval. Each delivery interval and publication timestamp combination must be unique.

Additional indexes

```
db.wind_forecast.createIndex({ publish_time: 1 })
```

The compound index already supports queries on `start_time` alone because `start_time` is its prefix. A separate single-field `start_time` index is therefore generally unnecessary. Add indexes based on actual query patterns and validate them with `explain()`.

## 2.3 `sync_run`

Tracks data synchronization operations.

Example document:

```
{
  "_id": "ObjectId",
  "dataset": "WINDFOR",
  "start_date": "2026-01-01T00:00:00Z",
  "end_date": "2026-02-01T00:00:00Z",
  "status": "COMPLETED",
  "records_received": 5000,
  "records_written": 4200,
  "started_at": "2026-01-15T10:00:00Z",
  "completed_at": "2026-01-15T10:02:30Z",
  "error_message": null
}
```

Allowed `dataset` values:

- `FUELHH`
- `WINDFOR`

Allowed `status` values:

- `RUNNING`
- `COMPLETED`
- `FAILED`

Index

```
db.sync_run.createIndex({ started_at: -1 })
```

`records_written` should be clearly defined in the ingestion service—for example, as the number of documents inserted or updated during a synchronization run.

## 3. Relationships

No foreign-key relationship is required between `actual_generation` and `wind_forecast`.

They are separate Elexon datasets, logically matched by `start_time` during analysis.

```
actual_generation
        |
        | start_time
        |
        +------------------+
                           |
                           v
                     wind_forecast
                     - start_time
                     - publish_time
```

One actual-generation interval can correspond to multiple forecast vintages.

MongoDB does not require these datasets to be embedded into one document. Keeping them in separate collections makes ingestion, updates, and forecast-history queries simpler.

## 4. Why forecast results are not stored

Do not create these collections initially:

- `forecast_analysis`
- `forecast_accuracy`

Metrics such as error, absolute error, MAE, RMSE, and bias are derived data. Calculate them in the analysis service.

This avoids stale calculated values when:

- Elexon data changes.
- Forecast-selection logic changes.
- Decision-cutoff assumptions change.

Cache results later only if profiling demonstrates a need and the cache has an explicit invalidation strategy.

## 5. Duplicate handling and synchronization

Use MongoDB upserts to make synchronization idempotent.

Actual generation:

```
from pymongo import UpdateOneoperation = UpdateOne(    {"start_time": start_time},    {        "$set": {            "generation_mw": generation_mw,            "fuel_type": "WIND",            "updated_at": now,        },        "$setOnInsert": {            "created_at": now,        },    },    upsert=True,)
```

Forecasts:

```
operation = UpdateOne(    {        "start_time": start_time,        "publish_time": publish_time,    },    {        "$set": {            "generation_mw": generation_mw,        },        "$setOnInsert": {            "created_at": now,        },    },    upsert=True,)
```

Execute batches with `bulk_write(operations, ordered=False)` where appropriate. Create the unique indexes before enabling ingestion.

The unique indexes are the final safeguard against duplicate records, including concurrent synchronization attempts.

## 6. Timestamp policy

All timestamps must be represented as UTC BSON `Date` values.

Important fields:

- `actual_generation.start_time`
- `wind_forecast.start_time`
- `wind_forecast.publish_time`
- `sync_run.start_date`
- `sync_run.end_date`
- `sync_run.started_at`
- `sync_run.completed_at`

Application boundaries must use timezone-aware Python `datetime` objects. Normalize incoming timestamps to UTC before persistence and comparison.

MongoDB BSON dates have millisecond precision. If the source has finer timestamp precision, confirm whether that precision matters before using timestamps as unique keys.

Never compare naive and timezone-aware Python datetime values.

## 7. Source-of-truth rule

```
Elexon API
    ↓
Normalize and validate
    ↓
MongoDB cache
    ↓
Analysis service
    ↓
FastAPI endpoints
    ↓
React dashboard
```

Elexon remains authoritative. MongoDB is a persistence and caching layer, not the source of truth.

The ingestion service should explicitly define how source corrections are handled, when data is refreshed, and how failed synchronization runs are recorded.

## 8. Future migration and maintainability

The original relational migration plan was SQLite to PostgreSQL. With this design, MongoDB is the selected database, so PostgreSQL is no longer a direct database upgrade path.

If requirements later call for relational integrity, SQL joins, or complex transactional workflows, PostgreSQL may be worth evaluating.

To keep business logic independent of the database:

- Use repository interfaces for actuals, forecasts, and sync runs.
- Keep PyMongo operations inside repository implementations.
- Keep forecast selection and accuracy calculations in the service layer.
- Centralize MongoDB connection configuration and index creation.
- Version index-management code and test it in CI.

MongoDB does not use Alembic. For this project, manage indexes through a repeatable, version-controlled initialization or database setup module.

## 9. Recommended implementation checklist

- Configure `MONGODB_URI` and `MONGODB_DATABASE` through environment variables.
- Create the three collections and their indexes.
- Implement repository methods using PyMongo.
- Add bulk upserts for actual and forecast ingestion.
- Record synchronization status and failures.
- Normalize all timestamps to UTC.
- Test duplicate ingestion and concurrent upserts.
- Test forecast-vintage selection against the procurement decision cutoff.
- Keep analysis metrics out of persistent collections.

Design rationale: This model preserves forecast history, prevents duplicate source records, and keeps analytical logic separate from persistence. Those are the key properties needed to make the dashboard's forecast-accuracy results reproducible.
