
export interface WindQuery {
  startDate?: string;
  endDate?: string;
  cutoffHour?: number;
  cutoffMinute?: number;
}

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

export type WindForecastStatus =
  | "matched"
  | "missing-actual"
  | "missing-forecast";
