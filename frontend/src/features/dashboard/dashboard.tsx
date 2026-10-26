import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { WindQuery } from "../wind/services/wind.service";
import useWind from "../wind/hooks/useWind";
import WindReadingsTable from "../wind/components/WindReadingsTable";

function formatNumber(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }

  return new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: 2,
  }).format(value);
}

function MetricCard({
  title,
  value,
  description,
  unit,
}: {
  title: string;
  value: string;
  description: string;
  unit?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>

      <CardContent>
        <div className="text-2xl font-semibold tracking-tight">
          {value}
          {unit && (
            <span className="ml-1 text-sm font-normal text-muted-foreground">
              {unit}
            </span>
          )}
        </div>

        <p className="mt-2 text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const [draftStartDate, setDraftStartDate] = useState("2026-01-01");
  const [draftEndDate, setDraftEndDate] = useState("2026-02-01");

  const [query, setQuery] = useState<WindQuery>({
    startDate: "2026-01-01",
    endDate: "2026-02-01",
    cutoffHour: 9,
    cutoffMinute: 0,
  });

  const { data, isPending, isFetching, error, refetch } = useWind(query);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!draftStartDate || !draftEndDate || draftStartDate >= draftEndDate) {
      return;
    }

    setQuery({
      startDate: draftStartDate,
      endDate: draftEndDate,
      cutoffHour: 9,
      cutoffMinute: 0,
    });
  }

  const metrics = data?.metrics;

  return (
    <main className="container mx-auto space-y-6 px-4 py-6 md:py-8">
      {/* Dashboard heading */}
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Wind Forecast Dashboard
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            National wind generation and day-ahead forecast accuracy.
          </p>
        </div>

        <Button
          variant="outline"
          onClick={() => void refetch()}
          disabled={isFetching}
        >
          {isFetching ? "Refreshing..." : "Refresh data"}
        </Button>
      </header>

      {/* Date filters */}
      <Card>
        <CardContent className="pt-6">
          <form
            onSubmit={handleSubmit}
            className="flex flex-col items-end gap-4 sm:flex-row"
          >
            <div className="grid w-full gap-2">
              <label htmlFor="start-date" className="text-sm font-medium">
                Start date
              </label>

              <Input
                id="start-date"
                type="date"
                value={draftStartDate}
                max={draftEndDate || undefined}
                onChange={(event) => setDraftStartDate(event.target.value)}
                required
              />
            </div>

            <div className="grid w-full gap-2">
              <label htmlFor="end-date" className="text-sm font-medium">
                End date (exclusive)
              </label>

              <Input
                id="end-date"
                type="date"
                value={draftEndDate}
                min={draftStartDate || undefined}
                onChange={(event) => setDraftEndDate(event.target.value)}
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full sm:w-auto"
              disabled={
                isFetching ||
                !draftStartDate ||
                !draftEndDate ||
                draftStartDate >= draftEndDate
              }
            >
              Apply filters
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Loading and error states */}
      {isPending && (
        <div className="rounded-lg border p-6 text-sm text-muted-foreground">
          Loading wind analysis…
        </div>
      )}

      {error && (
        <Card className="border-destructive">
          <CardContent className="space-y-3 pt-6">
            <p className="font-medium text-destructive">
              Unable to load wind analysis
            </p>

            <p className="text-sm text-muted-foreground">{error.message}</p>

            <Button
              variant="outline"
              onClick={() => void refetch()}
              disabled={isFetching}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* KPI cards */}
      {data && (
        <>
          <section aria-label="Wind forecast key performance indicators">
            <div className="mb-4">
              <h2 className="text-lg font-semibold tracking-tight">
                Forecast performance
              </h2>

              <p className="text-sm text-muted-foreground">
                Performance metrics calculated from matched actual and forecast
                intervals.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                title="Mean absolute error"
                value={formatNumber(metrics.mae_mw)}
                unit="MW"
                description="Average magnitude of forecast errors."
              />

              <MetricCard
                title="Root mean squared error"
                value={formatNumber(metrics.rmse_mw)}
                unit="MW"
                description="Penalizes larger forecast errors."
              />

              <MetricCard
                title="Forecast bias"
                value={formatNumber(metrics.bias_mw)}
                unit="MW"
                description="Positive indicates overforecasting."
              />

              <MetricCard
                title="Matched intervals"
                value={formatNumber(metrics.matched_intervals)}
                description={`Of ${formatNumber(metrics.total_intervals)} total intervals.`}
              />
            </div>
          </section>

          {/* Data coverage */}
          <section>
            <h2 className="mb-4 text-lg font-semibold tracking-tight">
              Analysis coverage
            </h2>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Card>
                <CardContent className="space-y-1 pt-6">
                  <p className="text-sm text-muted-foreground">
                    Analysis period
                  </p>
                  <p className="font-medium">
                    {data.start_date} — {data.end_date}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    End date is exclusive
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="space-y-1 pt-6">
                  <p className="text-sm text-muted-foreground">
                    Decision cutoff
                  </p>
                  <p className="font-medium">{data.decision_cutoff}</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="space-y-1 pt-6">
                  <p className="text-sm text-muted-foreground">
                    Missing actuals
                  </p>
                  <p className="text-2xl font-semibold">
                    {formatNumber(metrics.missing_actual_intervals)}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="space-y-1 pt-6">
                  <p className="text-sm text-muted-foreground">
                    Missing forecasts
                  </p>
                  <p className="text-2xl font-semibold">
                    {formatNumber(metrics.missing_forecast_intervals)}
                  </p>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Reusable table */}
          <WindReadingsTable readings={data.readings} />
        </>
      )}
    </main>
  );
}
