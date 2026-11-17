import { useModuleStore } from "@medbrains/stores";
import { useMemo } from "react";

/** The fields of a master-data gap row that decide whether it shows and how it is counted. */
export interface GapRow {
  priority?: "P0" | "P1" | "P2";
  targetType?: "settings" | "module" | "governance";
  /** The app the row's screen belongs to; the row is hidden while the hospital has it off. */
  brick?: string;
}

/** A gap row's priority; a row that names none is P1. */
export function gapPriority(item: GapRow) {
  return item.priority ?? "P1";
}

/** The gap rows whose screen the hospital can open: a row for a switched-off app leads nowhere. */
export function installedGaps<T extends GapRow>(
  items: readonly T[],
  disabledModules: ReadonlySet<string>,
): T[] {
  return items.filter((item) => !item.brick || !disabledModules.has(item.brick));
}

/**
 * The installed gap rows and the counts the master-data screen shows for them. Reads the
 * switched-off set, not a stable function, so the screen re-renders when an app is toggled.
 */
export function useInstalledGaps<T extends GapRow>(items: readonly T[]) {
  const disabledModules = useModuleStore((state) => state.disabledModules);
  return useMemo(() => {
    const gapItems = installedGaps(items, disabledModules);
    const p0Items = gapItems.filter((item) => gapPriority(item) === "P0");
    return {
      gapItems,
      missingP0Count: p0Items.length,
      missingSettingsTargetCount: gapItems.filter(
        (item) => item.targetType === "settings" || item.targetType === "governance",
      ).length,
      p0GapItems: p0Items.slice(0, 8),
    };
  }, [items, disabledModules]);
}
