export interface DataTableVirtualWindow<T> {
  bottomSpacerHeight: number;
  rows: T[];
  startIndex: number;
  topSpacerHeight: number;
}

interface ResolveDataTableVirtualWindowInput<T> {
  data: T[];
  enabled: boolean;
  overscan: number;
  rowHeight: number;
  scrollTop: number;
  viewportHeight: number;
}

const FALLBACK_VIEWPORT_ROWS = 10;

export function resolveDataTableVirtualWindow<T>({
  data,
  enabled,
  overscan,
  rowHeight,
  scrollTop,
  viewportHeight,
}: ResolveDataTableVirtualWindowInput<T>): DataTableVirtualWindow<T> {
  if (!enabled) {
    return {
      bottomSpacerHeight: 0,
      rows: data,
      startIndex: 0,
      topSpacerHeight: 0,
    };
  }

  const measuredViewportHeight = viewportHeight || rowHeight * FALLBACK_VIEWPORT_ROWS;
  const visibleCount = Math.ceil(measuredViewportHeight / rowHeight);
  const windowSize = Math.max(1, visibleCount + overscan * 2);
  const scrollStart = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const maxStart = Math.max(0, data.length - windowSize);
  const startIndex = Math.min(scrollStart, maxStart);
  const endIndex = Math.min(data.length, startIndex + windowSize);
  const rowCount = endIndex - startIndex;
  const topSpacerHeight = startIndex * rowHeight;
  const bottomSpacerHeight = Math.max(0, (data.length - startIndex - rowCount) * rowHeight);

  return {
    bottomSpacerHeight,
    rows: data.slice(startIndex, endIndex),
    startIndex,
    topSpacerHeight,
  };
}
