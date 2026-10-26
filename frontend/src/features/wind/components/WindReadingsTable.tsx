import type { ColumnDef } from "@tanstack/react-table";

import { DataTable, type DataTableFilter } from "@/components/common/DataTable";

import type { WindForecastStatus, WindReading } from "../types/wind.types";

function formatNumber(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }

  return new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(date);
}

function getForecastStatus(row: WindReading): WindForecastStatus {
  if (row.actual_generation_mw == null) {
    return "missing-actual";
  }

  if (row.forecast_generation_mw == null) {
    return "missing-forecast";
  }

  return "matched";
}

const STATUS_LABELS: Record<WindForecastStatus, string> = {
  matched: "Matched",
  "missing-actual": "Missing actual",
  "missing-forecast": "Missing forecast",
};

const windColumns: ColumnDef<WindReading>[] = [
  {
    accessorKey: "start_time",
    header: "Delivery interval",
    cell: ({ getValue }) => formatDateTime(getValue<string>()),
    sortingFn: (rowA, rowB, columnId) => {
      const a = new Date(rowA.getValue<string>(columnId)).getTime();
      const b = new Date(rowB.getValue<string>(columnId)).getTime();

      return a - b;
    },
  },
  {
    accessorKey: "actual_generation_mw",
    header: "Actual (MW)",
    cell: ({ getValue }) => formatNumber(getValue<number | null>()),
  },
  {
    accessorKey: "forecast_generation_mw",
    header: "Forecast (MW)",
    cell: ({ getValue }) => formatNumber(getValue<number | null>()),
  },
  {
    accessorKey: "forecast_publish_time",
    header: "Published at",
    cell: ({ getValue }) => formatDateTime(getValue<string | null>()),
    sortingFn: (rowA, rowB, columnId) => {
      const a = rowA.getValue<string | null>(columnId);
      const b = rowB.getValue<string | null>(columnId);

      if (!a && !b) return 0;
      if (!a) return -1;
      if (!b) return 1;

      return new Date(a).getTime() - new Date(b).getTime();
    },
  },
  {
    accessorKey: "forecast_error_mw",
    header: "Error (MW)",
    cell: ({ getValue }) => formatNumber(getValue<number | null>()),
  },
  {
    accessorKey: "absolute_error_mw",
    header: "Absolute error (MW)",
    cell: ({ getValue }) => formatNumber(getValue<number | null>()),
  },
  {
    id: "forecast_status",
    accessorFn: getForecastStatus,
    header: "Status",
    enableHiding: true,
    enableGlobalFilter: true,
    filterFn: (row, columnId, filterValue: WindForecastStatus) =>
      row.getValue<WindForecastStatus>(columnId) === filterValue,
    cell: ({ getValue }) => {
      const status = getValue<WindForecastStatus>();

      return (
        <span
          className={
            status === "matched"
              ? "font-medium text-green-700 dark:text-green-400"
              : "text-muted-foreground"
          }
        >
          {STATUS_LABELS[status]}
        </span>
      );
    },
  },
];

const windFilters: DataTableFilter[] = [
  {
    columnId: "forecast_status",
    title: "Status",
    options: [
      { label: "Matched", value: "matched" },
      { label: "Missing actual", value: "missing-actual" },
      { label: "Missing forecast", value: "missing-forecast" },
    ],
  },
];

interface WindReadingsTableProps {
  readings: WindReading[];
}

export default function WindReadingsTable({
  readings,
}: WindReadingsTableProps) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">
          Wind generation readings
        </h2>

        <p className="text-sm text-muted-foreground">
          Search, sort, filter and export actual generation and forecast
          accuracy data.
        </p>
      </div>

      <DataTable
        columns={windColumns}
        data={readings}
        filters={windFilters}
        searchPlaceholder="Search delivery times or generation..."
        exportFileName="wind-analysis.csv"
        initialPageSize={25}
        emptyMessage="No wind readings match your search or filters."
      />
    </section>
  );
}
