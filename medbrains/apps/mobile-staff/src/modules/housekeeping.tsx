/**
 * Housekeeping module — cleaning checklists, turnaround, linen,
 * laundry, pest control. NABH infection-control evidence trail.
 */

import type { ReactNode } from "react";
import { P } from "@medbrains/types";
import type { Module } from "@medbrains/mobile-shell";
import type { IntentTone } from "@medbrains/ui-mobile";
import { ModuleHome } from "../components/module-home.js";
import { ModuleRouter, useModuleRouter } from "../components/module-router.js";
import { EntityListScreen } from "../components/entity-list.js";
import { EntityRow } from "../components/entity-row.js";
import { listCleaningTasks } from "../api/housekeeping.js";

const STATUS_TONE: Record<string, IntentTone> = {
  pending: "warn",
  in_progress: "info",
  completed: "success",
  skipped: "neutral",
};

function HousekeepingHome(): ReactNode {
  const router = useModuleRouter();
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
          onPress: () => router.push("cleaning"),
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

function CleaningScreen(): ReactNode {
  return (
    <EntityListScreen
      eyebrow="HK"
      title="Cleaning tasks"
      fetcher={() => listCleaningTasks()}
      rowKey={(t) => t.id}
      renderRow={(t) => (
        <EntityRow
          title={`${t.area} · ${t.task_type}`}
          subtitle={`Scheduled ${new Date(t.scheduled_at).toLocaleString()}`}
          badge={{ label: t.status, tone: STATUS_TONE[t.status] ?? "neutral" }}
        />
      )}
      emptyTitle="No tasks"
    />
  );
}

function HousekeepingScreen(): ReactNode {
  return (
    <ModuleRouter
      initial="home"
      screens={{ home: <HousekeepingHome />, cleaning: <CleaningScreen /> }}
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
