# Wind Forecast Portal — System Design

## 1. Purpose

The Wind Forecast Portal is a decision-support application for a UK energy utility purchasing electricity from the day-ahead wholesale market.

The application helps users:

1. Understand the wind-generation forecasts that were available when procurement decisions were made.
2. Compare those forecasts against actual wind generation.
3. Quantify forecast accuracy and uncertainty.
4. Inspect forecast errors across January 2026.

The scope is intentionally limited to national-level UK wind generation data provided by Elexon.

---

## 2. Core Data Sources

### Actual Wind Generation

Elexon dataset:

FUELHH

Relevant fields:

- startTime
- fuelType
- generation

Only records where:

fuelType = WIND

are considered.

`startTime` represents the delivery interval.

---

### Wind Generation Forecast

Elexon dataset:

WINDFOR

Relevant fields:

- startTime
- publishTime
- generation

`startTime` represents the forecasted delivery interval.

`publishTime` represents when that forecast became available.

Multiple forecasts can exist for the same `startTime`.

---

## 3. System Architecture

Browser
|
v
React + TypeScript
|
| /api/\*
v
FastAPI
|
+-------------------------+
| |
v v
Forecast Analysis Elexon Client
Service |
| v
| Elexon BMRS API
|
v
Repository / Cache
|
v
SQLite

The application is deployed as a single Docker container.

The React application is compiled during the Docker build.

FastAPI:

- exposes `/api/*`
- performs analytics
- communicates with Elexon
- optionally persists/cache data
- serves the compiled React application

Only one public HTTP port is required.

---

## 4. Backend Responsibilities

### API Layer

Responsible for:

- request validation
- HTTP responses
- query parameters
- error handling

The API layer must not contain analytics or Elexon-specific business logic.

---

### Elexon Client

Responsible for:

- communicating with Elexon
- requesting FUELHH
- requesting WINDFOR
- handling HTTP failures
- parsing API responses
- normalizing timestamps

---

### Repository Layer

Responsible for:

- database operations
- caching retrieved Elexon records
- querying actual generation
- querying forecast history

Repository code must not contain forecast accuracy calculations.

---

### Analysis Service

Responsible for:

- matching forecasts and actuals
- selecting eligible forecast vintages
- calculating forecast errors
- calculating aggregate metrics
- producing frontend-ready analysis

---

## 5. Forecast Selection

For a target delivery interval:

1. Identify the delivery `startTime`.
2. Determine the applicable procurement decision cutoff.
3. Find forecasts having the same `startTime`.
4. Remove forecasts where `publishTime` is after the decision cutoff.
5. Select the forecast with the latest remaining `publishTime`.
6. Compare the selected forecast against actual generation.

Conceptually:

eligible_forecasts =
forecasts where publishTime <= decisionCutoff

selected_forecast =
max(eligible_forecasts.publishTime)

The decision-cutoff rule must be documented and verified against the relevant market context before final submission.

The system must never use a forecast published after the procurement decision merely because it is the latest forecast currently available.

---

## 6. Accuracy Metrics

For:

F = forecast generation
A = actual generation

### Error

error = F - A

Interpretation:

Positive:
forecast > actual

Negative:
forecast < actual

### Absolute Error

absolute_error = abs(F - A)

### MAE

MAE = mean(abs(F - A))

Primary accuracy metric.

### RMSE

RMSE = sqrt(mean((F - A)^2))

Used to expose large forecast errors.

### Bias

Bias = mean(F - A)

Used to determine systematic over-forecasting or under-forecasting.

MAPE should not be the primary metric because actual wind generation can approach or equal zero.

---

## 7. Data Period

The challenge is restricted to purchase decisions relevant to:

January 2026

The API should nevertheless keep date parameters explicit so the analysis implementation remains testable and extensible.

---

## 8. Database Strategy

The database is a cache/persistence layer, not the source of truth.

Elexon remains the authoritative source.

The database stores:

- actual wind-generation observations
- forecast vintages
- synchronization metadata

Derived analytics should normally be calculated by the analysis service rather than persisted.

Benefits:

- fewer repeated Elexon requests
- reproducible analysis
- faster dashboard requests
- easier debugging

SQLite is sufficient for the challenge deployment.

---

## 9. Frontend

React + TypeScript + Vite.

Primary dashboard:

### Summary

Display:

- MAE
- RMSE
- Bias
- observation count
- data coverage

### Generation Chart

Display:

Actual Generation
vs
Selected Forecast

over time.

### Error Analysis

Display forecast errors over the selected period.

### Detailed Table

Columns:

- Delivery Time
- Forecast Publish Time
- Forecast Generation
- Actual Generation
- Error
- Absolute Error

Support:

- date filtering
- sorting
- pagination where useful

---

## 10. API Design

Suggested endpoints:

GET /api/health

GET /api/analysis

GET /api/analysis/summary

GET /api/actuals

GET /api/forecasts

POST /api/sync

Example:

GET /api/analysis?start_date=2026-01-01&end_date=2026-01-31

---

## 11. Error Handling

External Elexon failures must not be exposed directly to clients.

Errors should distinguish:

- validation failure
- Elexon unavailable
- Elexon invalid response
- database failure
- insufficient data
- internal analysis failure

Use appropriate HTTP status codes and structured JSON error responses.

---

## 12. Testing

### Unit Tests

Test:

- forecast selection
- MAE
- RMSE
- bias
- timestamp normalization
- duplicate handling
- missing actuals
- missing forecasts

### Integration Tests

Test:

Elexon Client -> Service -> Repository

and:

API -> Analysis Service

External Elexon HTTP calls should be mocked in automated tests.

---

## 13. Deployment

Single Docker container.

Build:

1. Node builds React.
2. Poetry installs Python dependencies.
3. Final Python image receives backend runtime.
4. React `dist` is copied into the final image.
5. FastAPI serves API and frontend.

Production:

Browser
|
v
Docker Container : PORT
|
+-- /api/_ -> FastAPI
|
+-- /_ -> React SPA

---

## 14. Non-Goals

Do not implement:

- authentication
- user accounts
- RBAC
- trading execution
- electricity-price forecasting
- demand forecasting
- additional renewable datasets
- ML forecasting
- microservices
- message queues

unless time remains and a clear business justification exists.

The priority is correctness of forecast selection and forecast-accuracy analysis.
