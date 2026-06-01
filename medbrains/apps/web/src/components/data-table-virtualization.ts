export interface DataTableVirtualWindow<T> {
  bottomSpacerHeight: number;
  endIndex: number;
  rows: T[];
  totalHeight: number;
  renderedCount: number;
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
      endIndex: data.length,
      rows: data,
      totalHeight: data.length * Math.max(1, rowHeight),
      renderedCount: data.length,
      startIndex: 0,
      topSpacerHeight: 0,
    };
  }

  const safeRowHeight = Math.max(1, rowHeight);
  const safeOverscan = Math.max(0, overscan);
  const measuredViewportHeight = viewportHeight || safeRowHeight * FALLBACK_VIEWPORT_ROWS;
  const visibleCount = Math.ceil(measuredViewportHeight / safeRowHeight);
  const windowSize = Math.max(1, visibleCount + safeOverscan * 2);
  const scrollStart = Math.max(0, Math.floor(scrollTop / safeRowHeight) - safeOverscan);
  const maxStart = Math.max(0, data.length - windowSize);
  const startIndex = Math.min(scrollStart, maxStart);
  const endIndex = Math.min(data.length, startIndex + windowSize);
  const rowCount = endIndex - startIndex;
  const topSpacerHeight = startIndex * safeRowHeight;
  const bottomSpacerHeight = Math.max(0, (data.length - startIndex - rowCount) * safeRowHeight);
  const totalHeight = data.length * safeRowHeight;

  return {
    bottomSpacerHeight,
    endIndex,
    rows: data.slice(startIndex, endIndex),
    totalHeight,
    renderedCount: rowCount,
    startIndex,
    topSpacerHeight,
  };
}
