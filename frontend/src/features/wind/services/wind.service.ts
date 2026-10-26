
export interface WindReading {
  start_time: string;
  actual_generation_mw: number | null;
  forecast_generation_mw: number | null;
  forecast_publish_time: string | null;
  decision_cutoff?: string;
  forecast_error_mw: number | null;
  absolute_error_mw: number | null;
}

export interface WindMetrics {
  total_intervals: number;
  matched_intervals: number;
  missing_actual_intervals: number;
  missing_forecast_intervals: number;
  mae_mw: number | null;
  rmse_mw: number | null;
  bias_mw: number | null;
}

export interface WindAnalysis {
  start_date: string;
  end_date: string;
  decision_cutoff: string;
  metrics: WindMetrics;
  readings: WindReading[];
}

export interface PaginatedWindReadings {
  page: number;
  page_size: number;
  total: number;
  items: WindReading[];
}

export interface WindQuery {
  startDate?: string;
  endDate?: string;
  cutoffHour?: number;
  cutoffMinute?: number;
}

export interface ReadingsQuery extends WindQuery {
  page?: number;
  pageSize?: number;
}

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ?? "/api/v1/wind"
).replace(/\/$/, "");

function buildQuery(query: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      params.set(key, String(value));
    }
  }

  return params.toString();
}

async function request<T>(
  path: string,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal,
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;

    try {
      const body = await response.json();
      if (typeof body.detail === "string") {
        message = body.detail;
      }
    } catch {
      // Retain the HTTP status message when the response isn't JSON.
    }

    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

function mapDateQuery(query: WindQuery) {
  return {
    start_date: query.startDate ?? "2026-01-01",
    end_date: query.endDate ?? "2026-02-01",
    cutoff_hour: query.cutoffHour ?? 9,
    cutoff_minute: query.cutoffMinute ?? 0,
  };
}

const windService = {
  getAnalysis(
    query: WindQuery = {},
    signal?: AbortSignal,
  ): Promise<WindAnalysis> {
    const params = buildQuery(mapDateQuery(query));
    return request<WindAnalysis>(`/analysis?${params}`, signal);
  },

  getReadings(
    query: ReadingsQuery = {},
    signal?: AbortSignal,
  ): Promise<PaginatedWindReadings> {
    const params = buildQuery({
      ...mapDateQuery(query),
      page: query.page ?? 1,
      page_size: query.pageSize ?? 50,
    });

    return request<PaginatedWindReadings>(`/readings?${params}`, signal);
  },

  getHealth(signal?: AbortSignal) {
    return request<{
      status: "ok" | "degraded";
      database: "connected" | "disconnected";
    }>("/../../health", signal);
  },
};

export default windService;
