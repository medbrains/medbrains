import type { WidgetViewFilter } from "@medbrains/types";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface WidgetFilterState {
  /** Each widget's narrowing, by widget id; absent = hospital-wide. */
  filters: Record<string, WidgetViewFilter>;
  setDepartment: (widgetId: string, departmentId: string | null) => void;
}

/**
 * What each dashboard widget's viewer has narrowed it to. The page sends it
 * with its one data call; a tile and its expanded view change it. Kept in
 * this browser — a reader's own view, not the dashboard's configuration.
 */
export const useWidgetFilterStore = create<WidgetFilterState>()(
  persist(
    (set) => ({
      filters: {},
      setDepartment: (widgetId, departmentId) =>
        set((state) => {
          const { [widgetId]: _, ...rest } = state.filters;
          return {
            filters: departmentId ? { ...rest, [widgetId]: { department_id: departmentId } } : rest,
          };
        }),
    }),
    { name: "mb.widget.filters", storage: createJSONStorage(() => localStorage) },
  ),
);
