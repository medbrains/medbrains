import { type UIEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type DataTableVirtualWindow,
  resolveDataTableVirtualWindow,
} from "./data-table-virtualization";

interface UseDataTableVirtualInput<T> {
  data: T[];
  enabled: boolean;
  rowHeight: number;
  overscan: number;
}

interface UseDataTableVirtualResult<T> {
  virtualWindow: DataTableVirtualWindow<T>;
  setTableWrapperRef: (node: HTMLDivElement | null) => void;
  handleTableScroll: (event: UIEvent<HTMLDivElement>) => void;
}

/**
 * Owns the windowed-rendering viewport state for DataTable: tracks scroll
 * position via rAF-batched updates + a ResizeObserver, clamps overscroll,
 * and computes the visible row window. Lifted out so DataTable.tsx stays
 * focused on layout.
 */
export function useDataTableVirtual<T>({
  data,
  enabled,
  rowHeight,
  overscan,
}: UseDataTableVirtualInput<T>): UseDataTableVirtualResult<T> {
  const tableWrapperRef = useRef<HTMLDivElement | null>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const pendingScrollPositionRef = useRef({ scrollTop: 0, viewportHeight: 0 });
  const [viewport, setViewport] = useState({ scrollTop: 0, viewportHeight: 0 });

  const commitViewport = useCallback((next: typeof viewport) => {
    setViewport((current) =>
      current.scrollTop === next.scrollTop && current.viewportHeight === next.viewportHeight
        ? current
        : next,
    );
  }, []);

  const setTableWrapperRef = useCallback(
    (node: HTMLDivElement | null) => {
      tableWrapperRef.current = node;
      if (node) {
        commitViewport({ scrollTop: node.scrollTop, viewportHeight: node.clientHeight });
      }
    },
    [commitViewport],
  );

  const flushPendingScrollPosition = useCallback(() => {
    scrollFrameRef.current = null;
    commitViewport(pendingScrollPositionRef.current);
  }, [commitViewport]);

  const handleTableScroll = useCallback(
    (event: UIEvent<HTMLDivElement>) => {
      pendingScrollPositionRef.current = {
        scrollTop: event.currentTarget.scrollTop,
        viewportHeight: event.currentTarget.clientHeight,
      };
      if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") {
        flushPendingScrollPosition();
        return;
      }
      if (scrollFrameRef.current === null) {
        scrollFrameRef.current = window.requestAnimationFrame(flushPendingScrollPosition);
      }
    },
    [flushPendingScrollPosition],
  );

  useEffect(() => {
    return () => {
      if (scrollFrameRef.current !== null && typeof window !== "undefined") {
        window.cancelAnimationFrame(scrollFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const node = tableWrapperRef.current;
    if (!node) {
      return undefined;
    }
    commitViewport({ scrollTop: node.scrollTop, viewportHeight: node.clientHeight });
    if (typeof ResizeObserver === "undefined") {
      return undefined;
    }
    const observer = new ResizeObserver(() => {
      commitViewport({ scrollTop: node.scrollTop, viewportHeight: node.clientHeight });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [commitViewport]);

  useEffect(() => {
    const node = tableWrapperRef.current;
    if (!enabled || !node) {
      return;
    }
    const maxScrollTop = Math.max(0, data.length * rowHeight - node.clientHeight);
    if (node.scrollTop <= maxScrollTop) {
      return;
    }
    node.scrollTop = maxScrollTop;
    commitViewport({ scrollTop: maxScrollTop, viewportHeight: node.clientHeight });
  }, [commitViewport, data.length, rowHeight, enabled]);

  const virtualWindow = useMemo(
    () =>
      resolveDataTableVirtualWindow({
        data,
        enabled,
        overscan,
        rowHeight,
        scrollTop: viewport.scrollTop,
        viewportHeight: viewport.viewportHeight,
      }),
    [data, enabled, overscan, rowHeight, viewport.scrollTop, viewport.viewportHeight],
  );

  return { virtualWindow, setTableWrapperRef, handleTableScroll };
}
