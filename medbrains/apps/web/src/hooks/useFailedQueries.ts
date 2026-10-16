import { ApiError } from "@medbrains/api";
import { type Query, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useSyncExternalStore } from "react";

/**
 * Statuses that are answers, not outages: the session ended (handled by the
 * auth store), the caller may not see it, or it does not exist. The shell
 * fetches some things a role cannot see; those must not paint every page red.
 */
const ANSWER_STATUSES = new Set([401, 403, 404]);

function isOutage(query: Query): boolean {
  if (query.state.status !== "error" || query.getObserversCount() === 0) return false;
  const error = query.state.error;
  return !(error instanceof ApiError && ANSWER_STATUSES.has(error.status));
}

/**
 * The queries on screen right now that failed for a reason other than a
 * refusal — what an empty list must not be mistaken for. `retry` refetches
 * exactly those.
 */
export function useFailedQueries() {
  const cache = useQueryClient().getQueryCache();
  const subscribe = useCallback((onChange: () => void) => cache.subscribe(onChange), [cache]);
  // A string snapshot, so an unrelated cache event does not re-render.
  const key = useSyncExternalStore(subscribe, () =>
    cache
      .getAll()
      .filter(isOutage)
      .map((q) => q.queryHash)
      .join("|"),
  );
  return useMemo(() => {
    const failed = key ? cache.getAll().filter(isOutage) : [];
    return {
      failed,
      error: failed[0]?.state.error ?? null,
      retry: () => {
        for (const query of failed) void query.fetch();
      },
    };
  }, [key, cache]);
}
