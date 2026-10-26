import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface DataTableFilterOption {
  label: string;
  value: string;
}

export interface DataTableFilter {
  /** Must match a column ID in the table. */
  columnId: string;
  title: string;
  options: DataTableFilterOption[];
}

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  searchPlaceholder?: string;
  filters?: DataTableFilter[];
  exportFileName?: string;
  initialPageSize?: number;
  emptyMessage?: string;
}

function csvEscape(value: unknown): string {
  let text = value == null ? "" : String(value);

  // Prevent spreadsheet formula execution when opening exported CSV files.
  if (/^[\s]*[=+\-@]/.test(text)) {
    text = `'${text}`;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsv<TData>(
  headers: string[],
  rows: TData[],
  getValues: (row: TData) => unknown[],
  fileName: string,
) {
  const csv = [
    headers.map(csvEscape).join(","),
    ...rows.map((row) => getValues(row).map(csvEscape).join(",")),
  ].join("\r\n");

  const blob = new Blob(["\uFEFF", csv], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName.endsWith(".csv") ? fileName : `${fileName}.csv`;

  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchPlaceholder = "Search...",
  filters = [],
  exportFileName = "table-export.csv",
  initialPageSize = 25,
  emptyMessage = "No results found.",
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [globalFilter, setGlobalFilter] = useState("");

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      globalFilter,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: "includesString",
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageIndex: 0,
        pageSize: initialPageSize,
      },
    },
  });

  const visibleExportColumns = useMemo(
    () =>
      table.getVisibleLeafColumns().filter((column) => column.id !== "select"),
    // Column visibility changes should update export columns.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [columnVisibility, columns, table],
  );

  function handleExport() {
    // Export all filtered and sorted rows, not just the current page.
    const rows = table.getSortedRowModel().rows.map((row) => row.original);

    downloadCsv(
      visibleExportColumns.map((column) => {
        const header = column.columnDef.header;
        return typeof header === "string" ? header : column.id;
      }),
      rows,
      (row) =>
        visibleExportColumns.map((column) => {
          const tableRow = table
            .getCoreRowModel()
            .rows.find((item) => item.original === row);

          // Export raw row values by column ID. Accessor functions and
          // accessor keys are both supported through TanStack's row model.
          return tableRow?.getValue(column.id) ?? "";
        }),
      exportFileName,
    );
  }

  function handleFilterChange(columnId: string, value: string) {
    table
      .getColumn(columnId)
      ?.setFilterValue(value === "__all__" ? undefined : value);

    table.setPageIndex(0);
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            placeholder={searchPlaceholder}
            value={globalFilter}
            onChange={(event) => {
              setGlobalFilter(event.target.value);
              table.setPageIndex(0);
            }}
            className="w-full sm:max-w-sm"
            aria-label="Search table"
          />

          {filters.map((filter) => (
            <Select
              key={filter.columnId}
              value={String(
                table.getColumn(filter.columnId)?.getFilterValue() ?? "__all__",
              )}
              onValueChange={(value) =>
                handleFilterChange(filter.columnId, value)
              }
            >
              <SelectTrigger
                className="w-full sm:w-[190px]"
                aria-label={filter.title}
              >
                <SelectValue placeholder={filter.title} />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="__all__">
                  All {filter.title.toLowerCase()}
                </SelectItem>

                {filter.options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">Columns</Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end">
              {table
                .getAllLeafColumns()
                .filter((column) => column.getCanHide())
                .map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    checked={column.getIsVisible()}
                    onCheckedChange={(checked) =>
                      column.toggleVisibility(Boolean(checked))
                    }
                    onSelect={(event) => event.preventDefault()}
                  >
                    {typeof column.columnDef.header === "string"
                      ? column.columnDef.header
                      : column.id}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="outline"
            onClick={handleExport}
            disabled={table.getFilteredRowModel().rows.length === 0}
          >
            Export CSV
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : header.column.getCanSort() ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="-ml-3 h-8"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}

                        {{
                          asc: " ↑",
                          desc: " ↓",
                        }[header.column.getIsSorted() as "asc" | "desc"] ?? ""}
                      </Button>
                    ) : (
                      flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() ? "selected" : undefined}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={table.getVisibleLeafColumns().length}
                  className="h-24 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {table.getFilteredRowModel().rows.length} result(s)
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={String(table.getState().pagination.pageSize)}
            onValueChange={(value) => table.setPageSize(Number(value))}
          >
            <SelectTrigger className="w-[110px]">
              <SelectValue />
            </SelectTrigger>

            <SelectContent>
              {[10, 25, 50, 100].map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size} rows
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <p className="min-w-[100px] text-center text-sm text-muted-foreground">
            Page {table.getState().pagination.pageIndex + 1} of{" "}
            {Math.max(table.getPageCount(), 1)}
          </p>

          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

export default DataTable;
