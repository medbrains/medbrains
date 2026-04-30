/**
 * Housekeeping module — cleaning checklists, turnaround, linen,
 * laundry, pest control. NABH infection-control evidence trail.
 */

import { P } from "@medbrains/types";
import type { Module } from "@medbrains/mobile-shell";
import { ModuleHome } from "../components/module-home.js";

function HousekeepingScreen() {
  return (
    <ModuleHome
      eyebrow="MODULE"
      title="Housekeeping"
      description="Cleaning, turnaround, linen, laundry."
      summaries={[
        { eyebrow: "CLEAN", count: "—", title: "Pending bed turnaround" },
        { eyebrow: "LINEN", count: "—", title: "Soiled awaiting laundry" },
      ]}
      actions={[
        {
          id: "cleaning",
          label: "Cleaning checklists",
          description: "Per-area NABH-aligned tasks.",
          permission: P.HOUSEKEEPING.CLEANING_LIST,
        },
        {
          id: "turnaround",
          label: "Bed turnaround",
          description: "Discharge → terminal-clean → ready.",
          permission: P.HOUSEKEEPING.TURNAROUND_LIST,
        },
        {
          id: "linen",
          label: "Linen inventory",
          description: "Issue + return + condemnations.",
          permission: P.HOUSEKEEPING.LINEN_LIST,
        },
        {
          id: "laundry",
          label: "Laundry log",
          description: "Outsourced load tracking.",
          permission: P.HOUSEKEEPING.LAUNDRY_LIST,
        },
        {
          id: "pest",
          label: "Pest control",
          description: "Schedules + treatment records.",
          permission: P.HOUSEKEEPING.PEST_CONTROL_LIST,
        },
      ]}
    />
  );
}

export const housekeepingModule: Module = {
  id: "housekeeping",
  displayName: "Housekeeping",
  icon: () => null,
  requiredPermissions: [P.HOUSEKEEPING.CLEANING_LIST],
  navigator: HousekeepingScreen,
  offlineDocTypes: ["hk_task_complete", "hk_turnaround"],
};
