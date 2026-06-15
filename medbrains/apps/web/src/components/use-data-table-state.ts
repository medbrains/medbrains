import { useCallback, useMemo, useState } from "react";
import { nextSortState, type SortState, sortRows } from "./data-table-features";

type ValueGetter<T> = (row: T) => string | number | null | undefined;

/** Minimal structural view of a Column the state hook needs (avoids a type cycle). */
interface FeatureColumn<T> {
  key: string;
  sortValue?: ValueGetter<T>;
  accessor?: ValueGetter<T>;
  defaultHidden?: boolean;
}

interface UseDataTableStateInput<T> {
  columns: ReadonlyArray<FeatureColumn<T>>;
  data: T[];
  rowKey: (row: T) => string;
  sort?: SortState | null;
  defaultSort?: SortState;
  onSortChange?: (sort: SortState | null) => void;
  selectedKeys?: string[];
  onSelectionChange?: (keys: string[], rows: T[]) => void;
  storageKey?: string;
}

const STORAGE_PREFIX = "medbrains.datatable.cols.";

function readHiddenColumns(
  storageKey: string | undefined,
  fallback: () => Set<string>,
): Set<string> {
  if (!storageKey || typeof window === "undefined") return fallback();
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + storageKey);
    if (!raw) return fallback();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return fallback();
  }
}

/**
 * Owns the opt-in DataTable feature state — sorting, row selection and
 * column visibility — supporting both uncontrolled (internal) and
 * controlled (server-side) modes. Returns derived data + handlers.
 */
export function useDataTableState<T>(input: UseDataTableStateInput<T>) {
  const { columns, data, rowKey, defaultSort, onSortChange, onSelectionChange, storageKey } = input;
  const controlledSort = input.sort !== undefined;
  const controlledSelection = input.selectedKeys !== undefined;

  // ── Sorting ──────────────────────────────────────────────────
  const [innerSort, setInnerSort] = useState<SortState | null>(defaultSort ?? null);
  const activeSort = controlledSort ? (input.sort ?? null) : innerSort;

  const handleSort = useCallback(
    (key: string) => {
      const next = nextSortState(activeSort, key);
      if (!controlledSort) setInnerSort(next);
      onSortChange?.(next);
    },
    [activeSort, controlledSort, onSortChange],
  );

  const sortedData = useMemo(() => {
    if (controlledSort || !activeSort) return data;
    const col = columns.find((entry) => entry.key === activeSort.key);
    const getter = col?.sortValue ?? col?.accessor;
    return getter ? sortRows(data, getter, activeSort.dir) : data;
  }, [data, columns, activeSort, controlledSort]);

  // ── Selection ────────────────────────────────────────────────
  const [innerSelected, setInnerSelected] = useState<Set<string>>(() => new Set());
  const selectedSet = useMemo(
    () => (controlledSelection ? new Set(input.selectedKeys) : innerSelected),
    [controlledSelection, input.selectedKeys, innerSelected],
  );

  const emitSelection = useCallback(
    (next: Set<string>) => {
      if (!controlledSelection) setInnerSelected(next);
      if (onSelectionChange) {
        onSelectionChange(
          [...next],
          data.filter((row) => next.has(rowKey(row))),
        );
      }
    },
    [controlledSelection, data, onSelectionChange, rowKey],
  );

  const toggleRow = useCallback(
    (row: T) => {
      const key = rowKey(row);
      const next = new Set(selectedSet);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      emitSelection(next);
    },
    [emitSelection, rowKey, selectedSet],
  );

  const keysOnPage = useMemo(() => sortedData.map(rowKey), [sortedData, rowKey]);
  const selectedOnPage = keysOnPage.filter((key) => selectedSet.has(key)).length;
  const allSelected = keysOnPage.length > 0 && selectedOnPage === keysOnPage.length;
  const someSelected = selectedOnPage > 0 && !allSelected;

  const toggleAll = useCallback(() => {
    emitSelection(allSelected ? new Set() : new Set(keysOnPage));
  }, [allSelected, emitSelection, keysOnPage]);

  const clearSelection = useCallback(() => emitSelection(new Set()), [emitSelection]);

  const selectedRows = useMemo(
    () => data.filter((row) => selectedSet.has(rowKey(row))),
    [data, rowKey, selectedSet],
  );

  // ── Column visibility ────────────────────────────────────────
  const [hidden, setHidden] = useState<Set<string>>(() =>
    readHiddenColumns(
      storageKey,
      () => new Set(columns.filter((col) => col.defaultHidden).map((col) => col.key)),
    ),
  );

  const toggleColumn = useCallback(
    (key: string) => {
      setHidden((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        if (storageKey && typeof window !== "undefined") {
          try {
            window.localStorage.setItem(STORAGE_PREFIX + storageKey, JSON.stringify([...next]));
          } catch {
            // persistence is best-effort
          }
        }
        return next;
      });
    },
    [storageKey],
  );

  return {
    activeSort,
    handleSort,
    sortedData,
    selectedSet,
    toggleRow,
    toggleAll,
    clearSelection,
    allSelected,
    someSelected,
    selectedRows,
    hidden,
    toggleColumn,
  };
}
