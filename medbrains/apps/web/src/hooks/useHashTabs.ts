import { useCallback, useEffect, useState } from "react";

const SEPARATOR = "--";

function readHash() {
  return window.location.hash.replace("#", "");
}

/**
 * Syncs a Mantine Tabs value with the URL hash.
 *
 * Uses `history.replaceState` directly — no React Router navigation cycle,
 * so tab switches are instant with zero re-renders of the route tree.
 *
 * Supports **nested tabs** via compound hash: `#parent--child`
 *
 * @param defaultValue — fallback tab when no hash is present
 * @param validValues  — optional whitelist; ignores unknown hashes
 * @param options.nested — set true for sub-tabs within a parent hash tab
 */
export function useHashTabs(
  defaultValue: string,
  validValues?: readonly string[],
  options?: { nested?: boolean },
): [string, (value: string | null) => void] {
  const nested = options?.nested ?? false;

  const parseHash = useCallback(
    (raw: string) => {
      if (!raw) return defaultValue;

      if (nested) {
        const idx = raw.indexOf(SEPARATOR);
        if (idx === -1) return defaultValue;
        const sub = raw.slice(idx + SEPARATOR.length);
        if (!sub) return defaultValue;
        if (validValues && !validValues.includes(sub)) return defaultValue;
        return sub;
      }

      const main = raw.split(SEPARATOR)[0] ?? "";
      if (!main) return defaultValue;
      if (validValues && !validValues.includes(main)) return defaultValue;
      return main;
    },
    [defaultValue, validValues, nested],
  );

  const [tab, setTabState] = useState(() => parseHash(readHash()));

  // Sync on browser back/forward (hashchange fires for real navigation)
  useEffect(() => {
    const onHashChange = () => setTabState(parseHash(readHash()));
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [parseHash]);

  const setTab = useCallback(
    (value: string | null) => {
      const next = value ?? defaultValue;
      setTabState(next);

      let hash: string;
      if (nested) {
        const parentTab = readHash().split(SEPARATOR)[0] ?? "";
        hash = next === defaultValue ? parentTab : `${parentTab}${SEPARATOR}${next}`;
      } else {
        hash = next === defaultValue ? "" : next;
      }

      const url = hash
        ? `${window.location.pathname}${window.location.search}#${hash}`
        : `${window.location.pathname}${window.location.search}`;
      window.history.replaceState(null, "", url);
    },
    [defaultValue, nested],
  );

  return [tab, setTab];
}
