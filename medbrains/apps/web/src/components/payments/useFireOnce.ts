import { useCallback, useRef } from "react";

/**
 * Run a side effect at most once per key for the life of the component.
 *
 * A status poll's `queryFn` and `refetchInterval` run again on every refetch
 * (a window refocus, an invalidation, the next tick), so a "paid" callback
 * fired from them fires again — and a caller that records the sale or closes
 * the bill does it twice. Gate the callback on the payment's id instead.
 */
export function useFireOnce(): (key: string, effect: () => void) => void {
  const fired = useRef(new Set<string>());
  return useCallback((key: string, effect: () => void) => {
    if (fired.current.has(key)) return;
    fired.current.add(key);
    effect();
  }, []);
}
