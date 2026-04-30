/**
 * Tiny query hook — fetches once on mount, exposes `data` / `loading`
 * / `error` / `refetch`. Avoids pulling in TanStack Query just for
 * the staff app's read paths; offline writes bypass this and route
 * through the AuthzCache + Loro bridge directly.
 */

import { useCallback, useEffect, useState } from "react";

export interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useFetch<T>(fn: () => Promise<T>, deps: ReadonlyArray<unknown> = []): FetchState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const run = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fn()
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Request failed");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // The dependency list is forwarded by the caller; effect
    // re-runs when any of those change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => run(), [run]);

  return {
    data,
    loading,
    error,
    refetch: () => setTick((t) => t + 1),
  };
}
