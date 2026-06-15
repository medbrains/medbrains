import { useCallback, useMemo, useState } from "react";
import type { DataTableFilter } from "./data-table-types";

type ValueGetter<T> = (row: T) => string | number | null | undefined;

interface SearchColumn<T> {
  searchable?: boolean;
  searchValue?: ValueGetter<T>;
  accessor?: ValueGetter<T>;
}

interface UseDataTableFilterInput<T> {
  data: T[];
  columns: ReadonlyArray<SearchColumn<T>>;
  searchable?: boolean;
  filters?: DataTableFilter<T>[];
}

/**
 * Client-side search + extensible faceted filtering. Runs BEFORE sorting.
 * Global search scans the columns marked `searchable` (or all columns with an
 * accessor if none are marked); each active filter applies its `matches`
 * predicate. AND-combined.
 */
export function useDataTableFilter<T>({
  data,
  columns,
  searchable,
  filters,
}: UseDataTableFilterInput<T>) {
  const [query, setQuery] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});

  const setFilterValue = useCallback((key: string, value: string) => {
    setFilterValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const clearFilters = useCallback(() => {
    setQuery("");
    setFilterValues({});
  }, []);

  const filteredData = useMemo(() => {
    let rows = data;

    const trimmed = query.trim().toLowerCase();
    if (searchable && trimmed) {
      const searchCols = columns.filter((col) => col.searchable);
      const getters = (searchCols.length > 0 ? searchCols : columns)
        .map((col) => col.searchValue ?? col.accessor)
        .filter((getter): getter is ValueGetter<T> => Boolean(getter));
      rows = rows.filter((row) =>
        getters.some((getter) =>
          String(getter(row) ?? "")
            .toLowerCase()
            .includes(trimmed),
        ),
      );
    }

    for (const filter of filters ?? []) {
      const value = filterValues[filter.key];
      if (value) {
        rows = rows.filter((row) => filter.matches(row, value));
      }
    }

    return rows;
  }, [data, columns, searchable, query, filters, filterValues]);

  const activeFilterCount =
    Object.values(filterValues).filter(Boolean).length + (query.trim() ? 1 : 0);

  return {
    query,
    setQuery,
    filterValues,
    setFilterValue,
    clearFilters,
    filteredData,
    activeFilterCount,
  };
}
