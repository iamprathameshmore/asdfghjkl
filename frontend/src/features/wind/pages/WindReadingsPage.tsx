import { useState, type FormEvent } from "react";

import { useWind } from "../hooks/useWind";
import type { WindQuery } from "../services/wind.service";

function formatNumber(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";

  return new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(date);
}

function MetricCard({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <article className="wind-metric-card">
      <p className="wind-muted">{label}</p>
      <p className="wind-metric-value">
        {value}
        {unit ? <span className="wind-unit"> {unit}</span> : null}
      </p>
    </article>
  );
}

export default function WindReadingsPage() {
  const [draftStartDate, setDraftStartDate] = useState("2026-01-01");
  const [draftEndDate, setDraftEndDate] = useState("2026-02-01");

  const [appliedQuery, setAppliedQuery] = useState<WindQuery>({
    startDate: "2026-01-01",
    endDate: "2026-02-01",
    cutoffHour: 9,
    cutoffMinute: 0,
  });

  const { data, isPending, isFetching, error, refetch } = useWind(appliedQuery);

  const loading = isPending || isFetching;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!draftStartDate || !draftEndDate || draftStartDate >= draftEndDate) {
      return;
    }

    setAppliedQuery({
      startDate: draftStartDate,
      endDate: draftEndDate,
      cutoffHour: 9,
      cutoffMinute: 0,
    });
  }

  const metrics = data?.metrics;
  const readings = data?.readings ?? [];

  return (
    <main className="wind-page">
      <header className="wind-page-header">
        <div>
          <h1>Wind Forecast Analysis</h1>
          <p className="wind-muted">
            Compare day-ahead wind forecasts against actual generation.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void refetch()}
          disabled={isFetching}
        >
          {isFetching ? "Refreshing..." : "Refresh data"}
        </button>
      </header>

      <form className="wind-filter-form" onSubmit={handleSubmit}>
        <label>
          Start date
          <input
            type="date"
            value={draftStartDate}
            max={draftEndDate || undefined}
            onChange={(event) => setDraftStartDate(event.target.value)}
            required
          />
        </label>

        <label>
          End date (exclusive)
          <input
            type="date"
            value={draftEndDate}
            min={draftStartDate || undefined}
            onChange={(event) => setDraftEndDate(event.target.value)}
            required
          />
        </label>

        <button
          type="submit"
          disabled={
            loading ||
            !draftStartDate ||
            !draftEndDate ||
            draftStartDate >= draftEndDate
          }
        >
          Apply filters
        </button>
      </form>

      {error && (
        <div className="wind-error" role="alert">
          <strong>Unable to load analysis.</strong>
          <p>{error.message}</p>
          <p>
            Check that the backend is running, MongoDB is connected, and data
            has been ingested.
          </p>

          {data && (
            <button
              type="button"
              onClick={() => void refetch()}
              disabled={isFetching}
            >
              Retry
            </button>
          )}
        </div>
      )}

      {isPending && (
        <p role="status" className="wind-muted">
          Loading wind analysis…
        </p>
      )}

      {isFetching && !isPending && (
        <p role="status" className="wind-muted">
          Updating analysis…
        </p>
      )}

      {!isPending && data && (
        <>
          <section className="wind-metrics-grid" aria-label="Forecast metrics">
            <MetricCard
              label="Mean absolute error (MAE)"
              value={formatNumber(metrics?.mae_mw)}
              unit="MW"
            />

            <MetricCard
              label="Root mean squared error (RMSE)"
              value={formatNumber(metrics?.rmse_mw)}
              unit="MW"
            />

            <MetricCard
              label="Forecast bias"
              value={formatNumber(metrics?.bias_mw)}
              unit="MW"
            />

            <MetricCard
              label="Matched intervals"
              value={formatNumber(metrics?.matched_intervals)}
            />
          </section>

          <section className="wind-section">
            <div className="wind-section-header">
              <h2>Analysis coverage</h2>

              <span className="wind-muted">
                {data.start_date} to {data.end_date} (end exclusive)
              </span>
            </div>

            <p>
              Decision cutoff: <strong>{data.decision_cutoff}</strong>
            </p>

            <p>
              Total intervals: {metrics?.total_intervals ?? 0}
              {" · "}
              Missing actuals: {metrics?.missing_actual_intervals ?? 0}
              {" · "}
              Missing forecasts: {metrics?.missing_forecast_intervals ?? 0}
            </p>
          </section>

          <section className="wind-section">
            <h2>Wind generation readings</h2>

            {readings.length === 0 ? (
              <p className="wind-muted">
                No records found for this period. Confirm that Elexon data
                ingestion has completed.
              </p>
            ) : (
              <div className="wind-table-wrapper">
                <table className="wind-table">
                  <thead>
                    <tr>
                      <th scope="col">Delivery interval</th>
                      <th scope="col">Actual (MW)</th>
                      <th scope="col">Forecast (MW)</th>
                      <th scope="col">Forecast published</th>
                      <th scope="col">Error (MW)</th>
                      <th scope="col">Absolute error (MW)</th>
                    </tr>
                  </thead>

                  <tbody>
                    {readings.map((reading) => (
                      <tr key={reading.start_time}>
                        <td>{formatDateTime(reading.start_time)}</td>
                        <td>{formatNumber(reading.actual_generation_mw)}</td>
                        <td>{formatNumber(reading.forecast_generation_mw)}</td>
                        <td>{formatDateTime(reading.forecast_publish_time)}</td>
                        <td>{formatNumber(reading.forecast_error_mw)}</td>
                        <td>{formatNumber(reading.absolute_error_mw)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {!isPending && !error && !data && (
        <p className="wind-muted">No analysis data is available.</p>
      )}
    </main>
  );
}
