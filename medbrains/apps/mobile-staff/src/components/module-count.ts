/**
 * The number on a role's home tile.
 *
 * Every module home shipped with a literal "—" where its workload should be,
 * which is the first thing each role sees when they open the app.
 *
 * The rule that matters here is what happens when the fetch fails: it stays
 * "—", never 0. A tile reading "0 active incidents" because the network was
 * down is a lie that stops someone acting, and it is indistinguishable from a
 * genuinely quiet shift. Unknown has to look like unknown.
 */

import { useMemo } from "react";
import { useFetch } from "../lib/use-fetch.js";

/** Shown when the count is not known — loading, failed, or never fetched. */
export const COUNT_UNKNOWN = "—";

export interface ModuleCount {
  count: number | string;
  loading: boolean;
}

/**
 * The rule, separated from the hook so it can be tested without React.
 *
 * A failed fetch stays unknown. Returning 0 there would be indistinguishable
 * from a genuinely quiet shift and would stop someone acting on a queue that is
 * actually full.
 */
export function resolveCount<T>(
  data: ReadonlyArray<T> | null,
  error: string | null,
  matches?: (item: T) => boolean,
): number | string {
  if (error || !data) {
    return COUNT_UNKNOWN;
  }
  return matches ? data.filter(matches).length : data.length;
}

export function useModuleCount<T>(
  fetcher: () => Promise<ReadonlyArray<T>>,
  matches?: (item: T) => boolean,
): ModuleCount {
  const { data, loading, error } = useFetch(fetcher, []);

  const count = useMemo<number | string>(
    () => resolveCount(data, error, matches),
    [data, error, matches],
  );

  return { count, loading };
}
