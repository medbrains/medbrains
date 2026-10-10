import { useState } from "react";
import type { KpiBaseline } from "./kpi-reading";

const KEY = (widgetId: string) => `mb.widget.compare.${widgetId}`;
const VALID: KpiBaseline[] = ["weekday", "yesterday", "week"];

function stored(widgetId: string): KpiBaseline | null {
  try {
    const v = localStorage.getItem(KEY(widgetId));
    return VALID.includes(v as KpiBaseline) ? (v as KpiBaseline) : null;
  } catch {
    return null;
  }
}

/**
 * What one KPI tile is set against. The page's choice until this tile is
 * given its own; that choice is this viewer's convenience, kept in the
 * browser, and storage that is blocked simply means the page's choice.
 */
export function useWidgetCompare(
  widgetId: string,
  pageDefault: KpiBaseline,
): [KpiBaseline, (next: KpiBaseline) => void] {
  const [own, setOwn] = useState<KpiBaseline | null>(() => stored(widgetId));
  const choose = (next: KpiBaseline) => {
    setOwn(next);
    try {
      localStorage.setItem(KEY(widgetId), next);
    } catch {
      // Not remembered across visits; still applied now.
    }
  };
  return [own ?? pageDefault, choose];
}
